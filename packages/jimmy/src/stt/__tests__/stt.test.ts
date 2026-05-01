import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

vi.mock("../../shared/paths.js", () => ({
  STT_MODELS_DIR: "/mock/stt-models",
}));

vi.mock("node:fs");
vi.mock("node:child_process");

import { logger } from "../../shared/logger.js";
import { getSttStatus, getModelPath, initStt, resolveLanguages } from "../stt.js";

// ── TASK-067: initStt() ───────────────────────────────────────────────────────

describe("initStt", () => {
  beforeEach(() => {
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // AC-E028-01
  it("should call fs.mkdirSync with STT_MODELS_DIR and recursive: true", () => {
    initStt();
    expect(fs.mkdirSync).toHaveBeenCalledWith("/mock/stt-models", { recursive: true });
  });

  // AC-E028-02
  it("should log info message after initialization", () => {
    initStt();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("/mock/stt-models"));
  });
});

// ── TASK-068: getModelPath() ──────────────────────────────────────────────────

describe("getModelPath", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // AC-E028-03
  it("should return the full file path when the model file exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = getModelPath("tiny");
    expect(result).toBe("/mock/stt-models/ggml-tiny.bin");
    expect(fs.existsSync).toHaveBeenCalledWith("/mock/stt-models/ggml-tiny.bin");
  });

  // AC-E028-04
  it("should return null when the model file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = getModelPath("tiny");
    expect(result).toBeNull();
  });

  // AC-E028-05
  it("should return null immediately for an unknown model name", () => {
    const result = getModelPath("unknown-model-xyz");
    expect(result).toBeNull();
    expect(fs.existsSync).not.toHaveBeenCalled();
  });
});

// ── TASK-069: resolveLanguages() ──────────────────────────────────────────────

describe("resolveLanguages", () => {
  // AC-E028-06
  it("should return the languages array when languages array is provided", () => {
    expect(resolveLanguages({ languages: ["en", "ja"] })).toEqual(["en", "ja"]);
  });

  // AC-E028-07
  it("should return languages array over language string when both are provided", () => {
    expect(resolveLanguages({ languages: ["en"], language: "ja" })).toEqual(["en"]);
  });

  // AC-E028-08
  it("should return [language] when only language string is provided", () => {
    expect(resolveLanguages({ language: "fr" })).toEqual(["fr"]);
  });

  // AC-E028-09
  it("should return [en] when sttConfig is undefined", () => {
    expect(resolveLanguages(undefined)).toEqual(["en"]);
    expect(resolveLanguages()).toEqual(["en"]);
  });

  // AC-E028-10
  it("should fall back to language string when languages array is empty", () => {
    expect(resolveLanguages({ languages: [], language: "de" })).toEqual(["de"]);
  });
});

// ── TASK-070: getSttStatus() ──────────────────────────────────────────────────

describe("getSttStatus", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // AC-E028-11
  it("should return available: true and model name when model file exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const status = getSttStatus("tiny", ["en", "ja"]);
    expect(status.available).toBe(true);
    expect(status.model).toBe("tiny");
    expect(status.languages).toEqual(["en", "ja"]);
    expect(status.downloading).toBe(false);
  });

  // AC-E028-12
  it("should return available: false and model: null when model file is missing", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const status = getSttStatus("tiny");
    expect(status.available).toBe(false);
    expect(status.model).toBeNull();
  });

  // AC-E028-13
  it("should use small as default model and [en] as default languages when no args provided", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const status = getSttStatus();
    expect(status.languages).toEqual(["en"]);
    expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining("ggml-small.bin"));
  });
});
