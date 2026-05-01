import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("new-uuid-1234"),
}));

import { execFileSync } from "node:child_process";
import { forkClaudeSession, forkCodexSession, forkEngineSession, forkGeminiSession } from "../fork.js";

// ─── forkClaudeSession ───────────────────────────────────────────────────────

describe("forkClaudeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("成功時: execFileSync の出力から session_id を返す", () => {
    const fakeOutput = '\n{"session_id":"forked-session-123","result":"ok"}\n';
    vi.mocked(execFileSync).mockReturnValue(fakeOutput);

    const result = forkClaudeSession("orig-session", "/some/cwd");

    expect(result).toEqual({ engineSessionId: "forked-session-123" });
    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      "claude",
      expect.arrayContaining(["--resume", "orig-session", "--fork-session"]),
      expect.objectContaining({ cwd: "/some/cwd" }),
    );
  });

  it("空の出力の場合はエラーをスローする", () => {
    vi.mocked(execFileSync).mockReturnValue("   ");

    expect(() => forkClaudeSession("orig-session", "/some/cwd")).toThrow("Claude fork returned empty output");
  });

  it("JSON に session_id がない場合はエラーをスローする", () => {
    vi.mocked(execFileSync).mockReturnValue('{"result":"ok"}');

    expect(() => forkClaudeSession("orig-session", "/some/cwd")).toThrow("Claude fork did not return a session_id");
  });

  it("execFileSync が例外をスローした場合はそのまま再スローする", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("Command failed");
    });

    expect(() => forkClaudeSession("orig-session", "/some/cwd")).toThrow("Command failed");
  });

  it("複数行出力の場合は最後の行のみを使う", () => {
    const multiLineOutput =
      '{"session_id":"old-session","result":"partial"}\n{"session_id":"final-session","result":"done"}';
    vi.mocked(execFileSync).mockReturnValue(multiLineOutput);

    const result = forkClaudeSession("orig-session", "/some/cwd");

    expect(result).toEqual({ engineSessionId: "final-session" });
  });
});

// ─── forkCodexSession ────────────────────────────────────────────────────────

describe("forkCodexSession", () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(execFileSync).mockReset();
    // Create a real temp directory for Codex session file tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fork-codex-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("成功時: JSONL セッションファイルをコピーして新しい UUID を返す", () => {
    // セッションディレクトリ構造を作成: year/month/day/rollout-<ts>-<uuid>.jsonl
    const uuid = "target-uuid-abcd";
    const sessionsRoot = path.join(tempDir, ".codex", "sessions");
    const dayDir = path.join(sessionsRoot, "2026", "04", "28");
    fs.mkdirSync(dayDir, { recursive: true });

    const sessionFile = path.join(dayDir, `rollout-2026-04-28T10-00-00-${uuid}.jsonl`);
    const meta = { payload: { id: uuid }, timestamp: "2026-04-28T10:00:00Z" };
    fs.writeFileSync(sessionFile, JSON.stringify(meta));

    vi.spyOn(os, "homedir").mockReturnValue(tempDir);

    try {
      const result = forkCodexSession(uuid);
      expect(result.engineSessionId).toBe("new-uuid-1234");

      // 新しいファイルが作成されている
      const yearDirs = fs.readdirSync(sessionsRoot);
      let newFilesFound = false;
      for (const year of yearDirs) {
        const yearPath = path.join(sessionsRoot, year);
        for (const month of fs.readdirSync(yearPath)) {
          const monthPath = path.join(yearPath, month);
          for (const day of fs.readdirSync(monthPath)) {
            const dayPath = path.join(monthPath, day);
            const files = fs.readdirSync(dayPath);
            if (files.some((f) => f.includes("new-uuid-1234"))) {
              newFilesFound = true;
            }
          }
        }
      }
      expect(newFilesFound).toBe(true);
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });

  it("セッションファイルが見つからない場合はエラーをスローする", () => {
    vi.spyOn(os, "homedir").mockReturnValue(tempDir);
    // sessionsRoot 自体は存在するが中身が空
    const sessionsRoot = path.join(tempDir, ".codex", "sessions");
    fs.mkdirSync(sessionsRoot, { recursive: true });

    try {
      expect(() => forkCodexSession("nonexistent-uuid")).toThrow("Codex session file not found");
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });

  it("~/.codex/sessions が存在しない場合はエラーをスローする", () => {
    vi.spyOn(os, "homedir").mockReturnValue(tempDir);
    // sessionsRoot を作らない

    try {
      expect(() => forkCodexSession("nonexistent-uuid")).toThrow("Codex session file not found");
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });

  it("sessions ディレクトリにファイル（非ディレクトリ）がある場合はスキップする", () => {
    const uuid = "has-file-uuid";
    const sessionsRoot = path.join(tempDir, ".codex", "sessions");
    fs.mkdirSync(sessionsRoot, { recursive: true });

    // ディレクトリでなくファイルを年ディレクトリの場所に作成
    const fileInRoot = path.join(sessionsRoot, "not-a-dir.txt");
    fs.writeFileSync(fileInRoot, "dummy");

    // 実際のセッションは別の年ディレクトリに作成
    const dayDir = path.join(sessionsRoot, "2026", "04", "28");
    fs.mkdirSync(dayDir, { recursive: true });
    const sessionFile = path.join(dayDir, `rollout-2026-04-28T10-00-00-${uuid}.jsonl`);
    fs.writeFileSync(sessionFile, JSON.stringify({ payload: { id: uuid }, timestamp: "2026-04-28T10:00:00Z" }));

    vi.spyOn(os, "homedir").mockReturnValue(tempDir);

    try {
      const result = forkCodexSession(uuid);
      expect(result.engineSessionId).toBe("new-uuid-1234");
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });

  it("月ディレクトリにファイル（非ディレクトリ）がある場合はスキップする", () => {
    const uuid = "month-file-uuid";
    const sessionsRoot = path.join(tempDir, ".codex", "sessions");
    const yearDir = path.join(sessionsRoot, "2026");
    fs.mkdirSync(yearDir, { recursive: true });

    // 月ディレクトリの場所にファイルを作成
    fs.writeFileSync(path.join(yearDir, "not-a-month"), "dummy");

    // 実際のセッションは正しいパスに作成
    const dayDir = path.join(yearDir, "04", "28");
    fs.mkdirSync(dayDir, { recursive: true });
    const sessionFile = path.join(dayDir, `rollout-2026-04-28T10-00-00-${uuid}.jsonl`);
    fs.writeFileSync(sessionFile, JSON.stringify({ payload: { id: uuid }, timestamp: "2026-04-28T10:00:00Z" }));

    vi.spyOn(os, "homedir").mockReturnValue(tempDir);

    try {
      const result = forkCodexSession(uuid);
      expect(result.engineSessionId).toBe("new-uuid-1234");
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });

  it("日ディレクトリにファイル（非ディレクトリ）がある場合はスキップする", () => {
    const uuid = "day-file-uuid";
    const sessionsRoot = path.join(tempDir, ".codex", "sessions");
    const monthDir = path.join(sessionsRoot, "2026", "04");
    fs.mkdirSync(monthDir, { recursive: true });

    // 日ディレクトリの場所にファイルを作成
    fs.writeFileSync(path.join(monthDir, "not-a-day"), "dummy");

    // 実際のセッションは正しいパスに作成
    const dayDir = path.join(monthDir, "28");
    fs.mkdirSync(dayDir, { recursive: true });
    const sessionFile = path.join(dayDir, `rollout-2026-04-28T10-00-00-${uuid}.jsonl`);
    fs.writeFileSync(sessionFile, JSON.stringify({ payload: { id: uuid }, timestamp: "2026-04-28T10:00:00Z" }));

    vi.spyOn(os, "homedir").mockReturnValue(tempDir);

    try {
      const result = forkCodexSession(uuid);
      expect(result.engineSessionId).toBe("new-uuid-1234");
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });

  it("payload.id がない JSONL ファイルでもコピーできる", () => {
    const uuid = "no-payload-uuid";
    const sessionsRoot = path.join(tempDir, ".codex", "sessions");
    const dayDir = path.join(sessionsRoot, "2026", "04", "28");
    fs.mkdirSync(dayDir, { recursive: true });

    const sessionFile = path.join(dayDir, `rollout-2026-04-28T10-00-00-${uuid}.jsonl`);
    // payload.id のないメタ行
    const meta = { type: "session_meta", timestamp: "2026-04-28T10:00:00Z" };
    fs.writeFileSync(sessionFile, JSON.stringify(meta));

    vi.spyOn(os, "homedir").mockReturnValue(tempDir);

    try {
      const result = forkCodexSession(uuid);
      expect(result.engineSessionId).toBe("new-uuid-1234");
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });
});

// ─── forkGeminiSession ───────────────────────────────────────────────────────

describe("forkGeminiSession", () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fork-gemini-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("成功時: JSON セッションファイルをコピーして新しい UUID を返す", () => {
    const sessionId = "gemini-session-abcd1234";
    const geminiTmp = path.join(tempDir, ".gemini", "tmp");
    const chatsDir = path.join(geminiTmp, "project-hash-abc", "chats");
    fs.mkdirSync(chatsDir, { recursive: true });

    // ファイル名は sessionId の先頭8文字 (gemini-se) を含む
    const sessionFile = path.join(chatsDir, `session-2026-04-28T10-00-gemini-se.json`);
    const sessionData = {
      sessionId,
      startTime: "2026-04-28T10:00:00Z",
      lastUpdated: "2026-04-28T10:00:00Z",
      messages: [
        { id: "msg-1", role: "user", content: "hello" },
        { id: "msg-2", role: "assistant", content: "hi" },
      ],
    };
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData));

    vi.spyOn(os, "homedir").mockReturnValue(tempDir);

    try {
      const result = forkGeminiSession(sessionId);
      expect(result.engineSessionId).toBe("new-uuid-1234");

      // 新しいファイルが chatsDir に作成されている
      const files = fs.readdirSync(chatsDir);
      expect(files.some((f) => f.includes("new-uuid") || f.includes("1234"))).toBe(true);
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });

  it("sessions が messages を持たない場合でもコピーできる", () => {
    const sessionId = "gemini-nomsg-abcd1234";
    const geminiTmp = path.join(tempDir, ".gemini", "tmp");
    const chatsDir = path.join(geminiTmp, "proj-hash", "chats");
    fs.mkdirSync(chatsDir, { recursive: true });

    const sessionFile = path.join(chatsDir, `session-2026-04-28T10-00-gemini-no.json`);
    const sessionData = {
      sessionId,
      startTime: "2026-04-28T10:00:00Z",
      lastUpdated: "2026-04-28T10:00:00Z",
      // messages なし
    };
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData));

    vi.spyOn(os, "homedir").mockReturnValue(tempDir);

    try {
      const result = forkGeminiSession(sessionId);
      expect(result.engineSessionId).toBe("new-uuid-1234");
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });

  it("セッションファイルが見つからない場合はエラーをスローする", () => {
    const geminiTmp = path.join(tempDir, ".gemini", "tmp");
    fs.mkdirSync(geminiTmp, { recursive: true });

    vi.spyOn(os, "homedir").mockReturnValue(tempDir);

    try {
      expect(() => forkGeminiSession("nonexistent-sessionid")).toThrow("Gemini session file not found");
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });

  it("~/.gemini/tmp が存在しない場合はエラーをスローする", () => {
    vi.spyOn(os, "homedir").mockReturnValue(tempDir);
    // .gemini/tmp を作らない

    try {
      expect(() => forkGeminiSession("nonexistent-session")).toThrow("Gemini session file not found");
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });

  it("壊れた JSON ファイルはスキップして正しいファイルを見つける", () => {
    const sessionId = "gemini-valid-abcd1234";
    const geminiTmp = path.join(tempDir, ".gemini", "tmp");
    const chatsDir = path.join(geminiTmp, "proj-hash", "chats");
    fs.mkdirSync(chatsDir, { recursive: true });

    // 壊れた JSON ファイル（先頭8文字: gemini-v）
    const corruptFile = path.join(chatsDir, `session-2026-04-28T09-00-gemini-v.json`);
    fs.writeFileSync(corruptFile, "{ invalid json !!!");

    // 正常な JSON ファイル（同じ prefix）
    const validFile = path.join(chatsDir, `session-2026-04-28T10-00-gemini-v.json`);
    fs.writeFileSync(
      validFile,
      JSON.stringify({
        sessionId,
        startTime: "2026-04-28T10:00:00Z",
        lastUpdated: "2026-04-28T10:00:00Z",
      }),
    );

    vi.spyOn(os, "homedir").mockReturnValue(tempDir);

    try {
      const result = forkGeminiSession(sessionId);
      expect(result.engineSessionId).toBe("new-uuid-1234");
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });

  it("prefix を含まないファイルはスキップして正しいファイルを見つける", () => {
    const sessionId = "gemini-prefix-abcd1234";
    const geminiTmp = path.join(tempDir, ".gemini", "tmp");
    const chatsDir = path.join(geminiTmp, "proj-hash", "chats");
    fs.mkdirSync(chatsDir, { recursive: true });

    // prefix (gemini-pr) を含まないファイル
    const wrongFile = path.join(chatsDir, `session-2026-04-28T09-00-xxxxxxxx.json`);
    fs.writeFileSync(
      wrongFile,
      JSON.stringify({ sessionId: "totally-different-id", startTime: "2026-04-28T09:00:00Z" }),
    );

    // 正しいファイル（prefix: gemini-pr を含む）
    const correctFile = path.join(chatsDir, `session-2026-04-28T10-00-gemini-pr.json`);
    fs.writeFileSync(
      correctFile,
      JSON.stringify({ sessionId, startTime: "2026-04-28T10:00:00Z", lastUpdated: "2026-04-28T10:00:00Z" }),
    );

    vi.spyOn(os, "homedir").mockReturnValue(tempDir);

    try {
      const result = forkGeminiSession(sessionId);
      expect(result.engineSessionId).toBe("new-uuid-1234");
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });

  it("chatsDir がファイル（非ディレクトリ）の場合はスキップする", () => {
    const sessionId = "gemini-chatfile-abcd1234";
    const geminiTmp = path.join(tempDir, ".gemini", "tmp");
    const projDir = path.join(geminiTmp, "proj-with-file-chat");
    fs.mkdirSync(projDir, { recursive: true });

    // chats がファイルとして存在する
    const chatAsFile = path.join(projDir, "chats");
    fs.writeFileSync(chatAsFile, "not a directory");

    // 別のプロジェクトに正しいセッション
    const correctChatsDir = path.join(geminiTmp, "correct-proj", "chats");
    fs.mkdirSync(correctChatsDir, { recursive: true });
    const sessionFile = path.join(correctChatsDir, `session-2026-04-28T10-00-gemini-ch.json`);
    fs.writeFileSync(
      sessionFile,
      JSON.stringify({ sessionId, startTime: "2026-04-28T10:00:00Z", lastUpdated: "2026-04-28T10:00:00Z" }),
    );

    vi.spyOn(os, "homedir").mockReturnValue(tempDir);

    try {
      const result = forkGeminiSession(sessionId);
      expect(result.engineSessionId).toBe("new-uuid-1234");
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });

  it("chatsDir が存在しないプロジェクトハッシュはスキップする", () => {
    const sessionId = "gemini-haschats-abcd1234";
    const geminiTmp = path.join(tempDir, ".gemini", "tmp");
    // chats なしのプロジェクト
    const noChatsProjDir = path.join(geminiTmp, "no-chats-proj");
    fs.mkdirSync(noChatsProjDir, { recursive: true });
    // chats ありのプロジェクト
    const chatsDir = path.join(geminiTmp, "has-chats-proj", "chats");
    fs.mkdirSync(chatsDir, { recursive: true });

    const sessionFile = path.join(chatsDir, `session-2026-04-28T10-00-gemini-ha.json`);
    fs.writeFileSync(
      sessionFile,
      JSON.stringify({
        sessionId,
        startTime: "2026-04-28T10:00:00Z",
        lastUpdated: "2026-04-28T10:00:00Z",
      }),
    );

    vi.spyOn(os, "homedir").mockReturnValue(tempDir);

    try {
      const result = forkGeminiSession(sessionId);
      expect(result.engineSessionId).toBe("new-uuid-1234");
    } finally {
      vi.spyOn(os, "homedir").mockRestore();
    }
  });
});

// ─── forkEngineSession ───────────────────────────────────────────────────────

describe("forkEngineSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("engine='claude' のとき forkClaudeSession が呼ばれる", () => {
    vi.mocked(execFileSync).mockReturnValue('{"session_id":"new-claude-session"}');

    const result = forkEngineSession("claude", "orig-session", "/cwd");

    expect(result).toEqual({ engineSessionId: "new-claude-session" });
  });

  it("engine='codex' のとき forkCodexSession が呼ばれる（ファイルなしでエラー）", () => {
    expect(() => forkEngineSession("codex", "no-such-session", "/cwd")).toThrow("Codex session file not found");
  });

  it("engine='gemini' のとき forkGeminiSession が呼ばれる（ファイルなしでエラー）", () => {
    expect(() => forkEngineSession("gemini", "no-such-session", "/cwd")).toThrow("Gemini session file not found");
  });

  it("サポートされていない engine はエラーをスローする", () => {
    expect(() => forkEngineSession("unknown-engine", "session", "/cwd")).toThrow(
      "Unsupported engine for fork: unknown-engine",
    );
  });
});
