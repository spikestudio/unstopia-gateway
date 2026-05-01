import { EventEmitter } from "node:events";
import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock, spawnMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  spawnMock: vi.fn(),
}));

vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

vi.mock("../../shared/paths.js", () => ({
  STT_MODELS_DIR: "/mock/stt-models",
}));

vi.mock("node:fs");

vi.mock("node:child_process", () => ({
  default: { execFile: execFileMock, spawn: spawnMock },
  execFile: execFileMock,
  spawn: spawnMock,
}));

import { logger } from "../../shared/logger.js";
import { downloadModel, getSttStatus, getModelPath, initStt, resolveLanguages, transcribe } from "../stt.js";

// Helper to access hoisted mocks by type
const childProcess = { execFile: execFileMock, spawn: spawnMock };

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

// ── TASK-071: downloadModel() ─────────────────────────────────────────────────

describe("downloadModel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.renameSync).mockReturnValue(undefined);
    vi.mocked(fs.unlinkSync).mockReturnValue(undefined);
    vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as fs.Stats);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    // Reset module-level globals by re-importing (done via vi.resetModules in prod)
  });

  const makeCurlMock = (exitCode: number | null = 0, error?: Error) => {
    const curl = new EventEmitter() as EventEmitter & { kill: () => void };
    curl.kill = vi.fn();
    spawnMock.mockReturnValue(curl);
    // Schedule events after promises resolve
    setTimeout(() => {
      if (error) curl.emit("error", error);
      else curl.emit("close", exitCode);
    }, 10);
    return curl;
  };

  // AC-E028-14: 既存モデルはダウンロードをスキップして onProgress(100) を呼ぶ
  it("should skip download and call onProgress(100) when model already exists", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const onProgress = vi.fn();
    await downloadModel("tiny", onProgress);
    expect(spawnMock).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  // AC-E028-15: downloading 中に呼び出すとエラー
  it("should throw when download is already in progress", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    makeCurlMock(0);
    const onProgress = vi.fn();
    // Start first download (don't await)
    const p1 = downloadModel("tiny", onProgress);
    // Immediately try second
    await expect(downloadModel("tiny", onProgress)).rejects.toThrow("Download already in progress");
    // Cleanup first download
    await vi.advanceTimersByTimeAsync(20);
    await p1;
  });

  // AC-E028-16: 未知モデルはエラー
  it("should throw for unknown model name", async () => {
    await expect(downloadModel("unknown-xyz", vi.fn())).rejects.toThrow("Unknown model: unknown-xyz");
  });

  // AC-E028-17: curl 成功 → ファイルをリネームして onProgress(100)
  it("should rename temp file and call onProgress(100) on successful download", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    makeCurlMock(0);
    const onProgress = vi.fn();
    const p = downloadModel("tiny", onProgress);
    await vi.advanceTimersByTimeAsync(20);
    await p;
    expect(fs.renameSync).toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  // AC-E028-18: curl が非ゼロ終了 → 一時ファイル削除してエラー
  it("should delete temp file and throw when curl exits with non-zero code", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    makeCurlMock(1);
    const p = downloadModel("tiny", vi.fn());
    await vi.advanceTimersByTimeAsync(20);
    await expect(p).rejects.toThrow("curl exited with code 1");
    expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining(".downloading"));
  });

  // AC-E028-19: curl error イベント → 一時ファイル削除してエラー
  it("should delete temp file and throw when curl emits error event", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    makeCurlMock(null, new Error("ENOENT"));
    const p = downloadModel("tiny", vi.fn());
    await vi.advanceTimersByTimeAsync(20);
    await expect(p).rejects.toThrow("ENOENT");
    expect(fs.unlinkSync).toHaveBeenCalled();
  });
});

// ── TASK-072: transcribe() ────────────────────────────────────────────────────

describe("transcribe", () => {
  beforeEach(() => {
    vi.mocked(fs.unlinkSync).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockExecFile = (result: { stdout?: string; stderr?: string } | Error) => {
    execFileMock.mockImplementation((_cmd: string, _args: string[], _opts: unknown, callback: (err: Error | null, res?: unknown) => void) => {
      if (result instanceof Error) callback(result);
      // Return object so promisify resolves with {stdout, stderr}
      else callback(null, { stdout: result.stdout ?? "", stderr: result.stderr ?? "" });
    });
  };

  // AC-E028-20: WAV ファイルは直接 whisper-cli を実行
  it("should call whisper-cli directly for .wav files", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockExecFile({ stdout: "Hello world\n" });
    const result = await transcribe("/audio/test.wav", "tiny");
    expect(result).toBe("Hello world");
    expect(execFileMock).toHaveBeenCalledWith(
      "whisper-cli",
      expect.arrayContaining(["-f", "/audio/test.wav"]),
      expect.anything(),
      expect.any(Function),
    );
  });

  // AC-E028-21: 非 WAV はffmpegで変換後 whisper-cli を実行、一時ファイルを削除
  it("should convert non-WAV to WAV with ffmpeg and clean up temp file", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    // First execFile call: ffmpeg, second: whisper-cli (needs {stdout})
    let callCount = 0;
    execFileMock.mockImplementation((_cmd: string, _args: string[], _opts: unknown, callback: (err: null, res?: unknown) => void) => {
      callCount++;
      if (callCount === 1) callback(null, { stdout: "", stderr: "" }); // ffmpeg success
      else callback(null, { stdout: "Transcribed text\n", stderr: "" }); // whisper-cli
    });
    const result = await transcribe("/audio/test.mp3", "tiny");
    expect(result).toBe("Transcribed text");
    expect(execFileMock).toHaveBeenCalledWith("ffmpeg", expect.anything(), expect.anything(), expect.any(Function));
    expect(fs.unlinkSync).toHaveBeenCalledWith("/audio/test.wav");
  });

  // AC-E028-22: モデル未存在はエラー
  it("should throw when model file does not exist", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await expect(transcribe("/audio/test.wav", "tiny")).rejects.toThrow("Model 'tiny' not found");
  });

  // AC-E028-23: whisper-cli コマンド失敗はエラー
  it("should throw when whisper-cli fails", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockExecFile(new Error("whisper failed"));
    await expect(transcribe("/audio/test.wav", "tiny")).rejects.toThrow("whisper failed");
  });

  // AC-E028-24: language 引数を渡すと -l フラグが設定される
  it("should pass the language flag to whisper-cli", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockExecFile({ stdout: "Bonjour\n" });
    await transcribe("/audio/test.wav", "tiny", "fr");
    expect(childProcess.execFile).toHaveBeenCalledWith(
      "whisper-cli",
      expect.arrayContaining(["-l", "fr"]),
      expect.anything(),
      expect.any(Function),
    );
  });

  // AC-E028-25: ffmpeg 失敗 → 一時ファイルは作られないのでunlinkは呼ばれない（エラーのみ）
  it("should throw when ffmpeg conversion fails", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockExecFile(new Error("ffmpeg not found"));
    await expect(transcribe("/audio/test.mp3", "tiny")).rejects.toThrow("ffmpeg not found");
  });
});
