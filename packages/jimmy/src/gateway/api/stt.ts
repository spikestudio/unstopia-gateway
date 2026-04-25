import crypto from "node:crypto";
import fs from "node:fs";
import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import path from "node:path";
import yaml from "js-yaml";
import { logger } from "../../shared/logger.js";
import { CONFIG_PATH, TMP_DIR } from "../../shared/paths.js";
import {
  downloadModel,
  getSttStatus,
  resolveLanguages,
  transcribe as sttTranscribe,
  WHISPER_LANGUAGES,
} from "../../stt/stt.js";
import type { ApiContext } from "../types.js";
import { badRequest, json, readBodyRaw, readJsonBody, serverError } from "./utils.js";

export async function handleSttRequest(
  req: HttpRequest,
  res: ServerResponse,
  context: ApiContext,
  method: string,
  pathname: string,
  url: URL,
): Promise<boolean> {
  if (method === "GET" && pathname === "/api/stt/status") {
    const config = context.getConfig();
    const languages = resolveLanguages(config.stt);
    const status = getSttStatus(config.stt?.model, languages);
    json(res, status);
    return true;
  }

  if (method === "POST" && pathname === "/api/stt/download") {
    const config = context.getConfig();
    const model = config.stt?.model || "small";

    downloadModel(model, (progress) => {
      context.emit("stt:download:progress", { progress });
    })
      .then(() => {
        try {
          const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
          const cfg = yaml.load(raw) as Record<string, unknown>;
          if (!cfg.stt || typeof cfg.stt !== "object") cfg.stt = {};
          const sttCfg = cfg.stt as Record<string, unknown>;
          sttCfg.enabled = true;
          sttCfg.model = model;
          if (!sttCfg.languages) sttCfg.languages = ["en"];
          fs.writeFileSync(CONFIG_PATH, yaml.dump(cfg, { lineWidth: -1 }));
        } catch (err) {
          logger.error(`Failed to update config after STT download: ${err}`);
        }
        context.emit("stt:download:complete", { model });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`STT download failed: ${msg}`);
        context.emit("stt:download:error", { error: msg });
      });

    json(res, { status: "downloading", model });
    return true;
  }

  if (method === "POST" && pathname === "/api/stt/transcribe") {
    const config = context.getConfig();
    const model = config.stt?.model || "small";
    const languages = resolveLanguages(config.stt);
    const requestedLang = url.searchParams.get("language");
    const language = requestedLang && languages.includes(requestedLang) ? requestedLang : languages[0];

    const audioBuffer = await readBodyRaw(req);
    if (audioBuffer.length === 0) {
      badRequest(res, "No audio data");
      return true;
    }
    if (audioBuffer.length > 100 * 1024 * 1024) {
      badRequest(res, "Audio too large (100MB max)");
      return true;
    }

    const contentType = req.headers["content-type"] || "audio/webm";
    const ext = contentType.includes("wav")
      ? ".wav"
      : contentType.includes("mp4") || contentType.includes("m4a")
        ? ".m4a"
        : contentType.includes("ogg")
          ? ".ogg"
          : ".webm";

    const tmpFile = path.join(TMP_DIR, `stt-${crypto.randomUUID()}${ext}`);
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(tmpFile, audioBuffer);

    try {
      const text = await sttTranscribe(tmpFile, model, language);
      json(res, { text });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`STT transcription failed: ${msg}`);
      serverError(res, `Transcription failed: ${msg}`);
      return true;
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }
  }

  if (method === "PUT" && pathname === "/api/stt/config") {
    const _parsed = await readJsonBody(req, res);
    if (!_parsed.ok) return true;
    const body = _parsed.body as Record<string, unknown>;
    const langs = body.languages;

    if (!Array.isArray(langs) || langs.length === 0) {
      badRequest(res, "languages must be a non-empty array");
      return true;
    }

    const invalid = langs.filter((l) => typeof l !== "string" || !WHISPER_LANGUAGES[l]);
    if (invalid.length > 0) {
      badRequest(res, `Invalid language codes: ${invalid.join(", ")}`);
      return true;
    }

    try {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      const cfg = yaml.load(raw) as Record<string, unknown>;
      if (!cfg.stt || typeof cfg.stt !== "object") cfg.stt = {};
      const sttCfg = cfg.stt as Record<string, unknown>;
      sttCfg.languages = langs;
      delete sttCfg.language;
      fs.writeFileSync(CONFIG_PATH, yaml.dump(cfg, { lineWidth: -1 }));
      json(res, { status: "ok", languages: langs });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      serverError(res, `Failed to update STT config: ${msg}`);
      return true;
    }
  }

  return false;
}
