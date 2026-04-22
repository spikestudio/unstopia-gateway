/**
 * Conversation storage and utility functions for the Jinn chat.
 * Conversations are keyed by sessionId (not agentId).
 */

export type MediaType = "image" | "audio" | "file";

export interface MediaAttachment {
  type: MediaType;
  url: string;
  name?: string;
  mimeType?: string;
  duration?: number;
  waveform?: number[];
  size?: number;
  /** Server-side file ID after upload (set by chat-pane before sending) */
  fileId?: string;
  /** Original File object for upload (not serialized) */
  file?: File;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "notification";
  content: string;
  timestamp: number;
  media?: MediaAttachment[];
  toolCall?: string;
}

export interface Conversation {
  sessionId: string;
  messages: Message[];
  lastActivity: number;
}

export type ConversationStore = Record<string, Conversation>;

const STORAGE_KEY = "jinn-conversations";

export function loadConversations(): ConversationStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveConversations(store: ConversationStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* storage full — silently skip */
  }
}

export function addMessage(store: ConversationStore, sessionId: string, msg: Message): ConversationStore {
  const conv = store[sessionId] || {
    sessionId,
    messages: [],
    lastActivity: Date.now(),
  };
  return {
    ...store,
    [sessionId]: {
      ...conv,
      messages: [...conv.messages, msg],
      lastActivity: Date.now(),
    },
  };
}

/**
 * Extract image / audio URLs from markdown content.
 */
// --- Intermediate message persistence (localStorage) ---

const INTERMEDIATE_PREFIX = "jinn-intermediate-";

export function saveIntermediateMessages(sessionId: string, messages: Message[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${INTERMEDIATE_PREFIX}${sessionId}`, JSON.stringify(messages));
  } catch {
    /* storage full — silently skip */
  }
}

export function loadIntermediateMessages(sessionId: string): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${INTERMEDIATE_PREFIX}${sessionId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearIntermediateMessages(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${INTERMEDIATE_PREFIX}${sessionId}`);
  } catch {
    /* ignore */
  }
}

// --- Media parsing ---

export function parseMedia(content: string): MediaAttachment[] {
  const media: MediaAttachment[] = [];

  // Markdown images: ![alt](url)
  const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+\.(jpg|jpeg|png|gif|webp|svg)(\?[^)]*)?)\)/gi;
  let m = imgRegex.exec(content);
  while (m !== null) {
    media.push({ type: "image", url: m[2], name: m[1] || "Image" });
    m = imgRegex.exec(content);
  }

  // Bare image URLs not already captured
  const bareImgRegex = /(?<!\]\()https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)(\?\S*)?\b/gi;
  let mBare = bareImgRegex.exec(content);
  while (mBare !== null) {
    const url = mBare[0];
    if (!media.find((x) => x.url === url)) {
      media.push({ type: "image", url });
    }
    mBare = bareImgRegex.exec(content);
  }

  // Audio URLs
  const audioRegex = /https?:\/\/\S+\.(mp3|wav|ogg|m4a|aac)(\?\S*)?\b/gi;
  let mAudio = audioRegex.exec(content);
  while (mAudio !== null) {
    media.push({ type: "audio", url: mAudio[0], name: mAudio[0].split("/").pop() });
    mAudio = audioRegex.exec(content);
  }

  return media;
}
