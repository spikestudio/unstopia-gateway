import { logger } from "../shared/logger.js";
import type { EngineRateLimitInfo, StreamDelta } from "../shared/types.js";

/**
 * AC-E019-01, AC-E019-10: StreamState — ストリーミング処理の状態一覧
 *
 * 状態遷移:
 *   Idle     → InTool : content_block_start (tool_use)
 *   Idle     → InText : content_block_delta (text_delta)
 *   InText   → Idle   : content_block_stop
 *   InTool   → Idle   : content_block_stop
 *   InText   → InText : content_block_delta (text_delta)
 *   InTool   → InTool : content_block_delta (ignored)
 */
export type StreamState = "Idle" | "InText" | "InTool";

/** 処理結果の型 */
export type StreamLineResult =
  | { type: "__result"; msg: Record<string, unknown> }
  | { type: "__rate_limit"; info: EngineRateLimitInfo }
  | { type: "__tool_start"; delta: StreamDelta }
  | { type: "__tool_end"; delta: StreamDelta }
  | { type: "delta"; delta: StreamDelta };

/**
 * AC-E019-01, AC-E019-02, AC-E019-03: ClaudeStreamProcessor
 *
 * Claude CLI の stream-json 形式のイベントを逐行解析するクラス。
 * - 状態（Idle / InText / InTool）を内部管理し、状態遷移を型で明示する
 * - msgType ごとの分岐を独立したハンドラメソッドに分離し、ネストを3段以下に抑える
 * - 外部プロセス（spawn）なしにテスト可能な独立クラス
 */
export class ClaudeStreamProcessor {
  /** AC-E019-01: 現在のストリーミング状態 */
  private _state: StreamState = "Idle";

  get state(): StreamState {
    return this._state;
  }

  /**
   * AC-E019-02: ストリーム行を解析して結果を返す。
   * ネストが3段以下で、msgType ごとの分岐が独立したハンドラメソッドに分かれている。
   *
   * AC-E019-03: 外部プロセスなしにテスト可能（spawn 依存なし）
   */
  process(line: string, lineCount: number): StreamLineResult | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    if (lineCount <= 5) {
      logger.debug(`[claude stream] line ${lineCount}: ${trimmed.slice(0, 300)}`);
    }

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      logger.debug(`[claude stream] unparseable line: ${trimmed.slice(0, 100)}`);
      return null;
    }

    const msgType = String(msg.type || "");

    if (msgType === "result") {
      return this.handleResult(msg);
    }

    if (msgType === "rate_limit_event") {
      return this.handleRateLimitEvent(msg);
    }

    if (msgType === "assistant") {
      return this.handleAssistant(msg);
    }

    if (msgType === "stream_event") {
      return this.handleStreamEvent(msg);
    }

    return null;
  }

  // ---- ハンドラメソッド (AC-E019-02: msgType ごとに独立) ----

  /** result イベント: 最終結果を返す */
  private handleResult(msg: Record<string, unknown>): StreamLineResult {
    return { type: "__result", msg };
  }

  /** rate_limit_event イベント: レート制限情報を返す */
  private handleRateLimitEvent(msg: Record<string, unknown>): StreamLineResult | null {
    const info = parseRateLimitInfo(msg.rate_limit_info);
    if (!info) return null;
    return { type: "__rate_limit", info };
  }

  /**
   * assistant イベント: 部分的なアシスタントメッセージ（テキストスナップショット）を返す。
   * ドロップされた text_delta イベントを補正するために使用する。
   */
  private handleAssistant(msg: Record<string, unknown>): StreamLineResult | null {
    const message = msg.message as Record<string, unknown> | undefined;
    if (!message) return null;
    const content = message.content as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(content)) return null;

    const textParts = content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string);

    if (textParts.length === 0) return null;
    return { type: "delta", delta: { type: "text_snapshot", content: textParts.join("") } };
  }

  /**
   * stream_event イベント: content_block_* サブイベントを処理する。
   * AC-E019-01: 状態遷移（Idle ↔ InTool, InText ↔ Idle）を実行する。
   */
  private handleStreamEvent(msg: Record<string, unknown>): StreamLineResult | null {
    const event = msg.event as Record<string, unknown> | undefined;
    if (!event) return null;
    const eventType = String(event.type || "");

    if (eventType === "content_block_start") {
      return this.handleContentBlockStart(event);
    }

    if (eventType === "content_block_delta") {
      return this.handleContentBlockDelta(event);
    }

    if (eventType === "content_block_stop") {
      return this.handleContentBlockStop();
    }

    return null;
  }

  /**
   * content_block_start: ツール使用開始を検出し、InTool 状態に遷移する。
   * Idle → InTool (tool_use block) / それ以外は状態変更なし
   */
  private handleContentBlockStart(event: Record<string, unknown>): StreamLineResult | null {
    const block = event.content_block as Record<string, unknown> | undefined;
    if (block?.type !== "tool_use") return null;

    this._state = "InTool";
    const toolName = String(block.name || "unknown");
    const toolId = String(block.id || "");
    return {
      type: "__tool_start",
      delta: { type: "tool_use", content: `Using ${toolName}`, toolName, toolId },
    };
  }

  /**
   * content_block_delta: テキストデルタを処理する。
   * InTool 状態ではテキストを無視する（ツール実行中は出力しない）。
   * Idle → InText (text_delta) / InText → InText (text_delta)
   */
  private handleContentBlockDelta(event: Record<string, unknown>): StreamLineResult | null {
    const delta = event.delta as Record<string, unknown> | undefined;
    if (!delta) return null;

    if (delta.type === "text_delta" && this._state !== "InTool") {
      const text = String(delta.text || "");
      if (!text) return null;
      this._state = "InText";
      return { type: "delta", delta: { type: "text", content: text } };
    }

    return null;
  }

  /**
   * content_block_stop: ブロック終了。InTool / InText → Idle に遷移する。
   * InTool 状態の場合はツール終了イベントを返す。
   */
  private handleContentBlockStop(): StreamLineResult | null {
    const wasInTool = this._state === "InTool";
    this._state = "Idle";
    return wasInTool ? { type: "__tool_end", delta: { type: "tool_result", content: "" } } : null;
  }
}

/**
 * レート制限情報をパースする純粋関数。
 * ClaudeEngine.parseRateLimitInfo から抽出し、テスト可能な独立関数にした。
 */
export function parseRateLimitInfo(value: unknown): EngineRateLimitInfo | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  const info: EngineRateLimitInfo = {};

  if (typeof obj.status === "string") info.status = obj.status;
  const resetsAt = obj.resetsAt;
  if (typeof resetsAt === "number" && Number.isFinite(resetsAt)) info.resetsAt = resetsAt;
  if (typeof resetsAt === "string" && resetsAt.trim()) {
    const parsed = Number(resetsAt);
    if (Number.isFinite(parsed)) info.resetsAt = parsed;
  }
  if (typeof obj.rateLimitType === "string") info.rateLimitType = obj.rateLimitType;
  if (typeof obj.overageStatus === "string") info.overageStatus = obj.overageStatus;
  if (typeof obj.overageDisabledReason === "string") info.overageDisabledReason = obj.overageDisabledReason;
  if (typeof obj.isUsingOverage === "boolean") info.isUsingOverage = obj.isUsingOverage;

  return Object.keys(info).length > 0 ? info : undefined;
}
