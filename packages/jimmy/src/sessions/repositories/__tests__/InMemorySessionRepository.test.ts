import { beforeEach, describe, expect, it } from "vitest";
import { InMemorySessionRepository } from "../InMemorySessionRepository.js";

describe("AC-6 InMemorySessionRepository", () => {
  let repo: InMemorySessionRepository;

  beforeEach(() => {
    repo = new InMemorySessionRepository();
  });

  it("AC-6: createSession でセッションを生成できる", () => {
    const session = repo.createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:123",
    });

    expect(session.id).toBeDefined();
    expect(session.engine).toBe("claude");
    expect(session.source).toBe("web");
    expect(session.status).toBe("idle");
    expect(session.totalCost).toBe(0);
    expect(session.totalTurns).toBe(0);
  });

  it("AC-6: getSession で作成済みセッションを取得できる", () => {
    const created = repo.createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:456",
    });

    const result = repo.getSession(created.id);
    expect(result.ok).toBe(true);
    const found = result.ok ? result.value : null;
    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
  });

  it("AC-6: updateSession でフィールドを更新できる", () => {
    const session = repo.createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:789",
    });

    const result = repo.updateSession(session.id, { status: "running", title: "新しいタイトル" });
    const updated = result.ok ? result.value : null;
    expect(updated?.status).toBe("running");
    expect(updated?.title).toBe("新しいタイトル");
  });

  it("AC-6: deleteSession でセッションを削除できる", () => {
    const session = repo.createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:999",
    });

    const deleted = repo.deleteSession(session.id);
    expect(deleted).toBe(true);
    const afterResult = repo.getSession(session.id);
    expect(afterResult.ok ? afterResult.value : undefined).toBeNull();
  });

  it("AC-6: listSessions でフィルタ適用済み一覧を取得できる", () => {
    repo.createSession({ engine: "claude", source: "web", sourceRef: "web:1" });
    const s2 = repo.createSession({ engine: "codex", source: "slack", sourceRef: "slack:1" });
    repo.updateSession(s2.id, { status: "running" });

    const running = repo.listSessions({ status: "running" });
    expect(running).toHaveLength(1);
    expect(running[0].id).toBe(s2.id);
  });

  it("AC-6: accumulateSessionCost でコストと回数を加算できる", () => {
    const session = repo.createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:cost",
    });

    repo.accumulateSessionCost(session.id, 0.5, 3);
    repo.accumulateSessionCost(session.id, 0.3, 2);

    const result = repo.getSession(session.id);
    const updated = result.ok ? result.value : null;
    expect(updated?.totalCost).toBeCloseTo(0.8);
    expect(updated?.totalTurns).toBe(5);
  });

  it("AC-6: recoverStaleSessions で running セッションを interrupted に変更できる", () => {
    const s1 = repo.createSession({ engine: "claude", source: "web", sourceRef: "web:stale1" });
    const s2 = repo.createSession({ engine: "claude", source: "web", sourceRef: "web:stale2" });
    repo.updateSession(s1.id, { status: "running" });
    repo.updateSession(s2.id, { status: "running" });

    const count = repo.recoverStaleSessions();
    expect(count).toBe(2);
    const r1 = repo.getSession(s1.id);
    const r2 = repo.getSession(s2.id);
    expect((r1.ok ? r1.value : null)?.status).toBe("interrupted");
    expect((r2.ok ? r2.value : null)?.status).toBe("interrupted");
  });
});

describe("Result-typed methods (AC-E021-05, AC-E021-06)", () => {
  let repo: InMemorySessionRepository;

  beforeEach(() => {
    repo = new InMemorySessionRepository();
  });

  it("findById returns Ok<Session> when session exists", () => {
    const created = repo.createSession({ engine: "claude", source: "slack", sourceRef: "s:C1", sessionKey: "s:C1" });
    const result = repo.findById(created.id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.id).toBe(created.id);
  });

  it("findById returns Ok<null> when session not found", () => {
    const result = repo.findById("not-exist");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it("findByKey returns Ok<Session> when sessionKey matches", () => {
    repo.createSession({ engine: "claude", source: "slack", sourceRef: "s:C2", sessionKey: "s:C2" });
    const result = repo.findByKey("s:C2");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.sessionKey).toBe("s:C2");
  });

  it("update returns Ok<Session|null> on success", () => {
    const created = repo.createSession({ engine: "claude", source: "slack", sourceRef: "s:C3", sessionKey: "s:C3" });
    const result = repo.update(created.id, { status: "running" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.status).toBe("running");
  });

  it("createSession sets effortLevel when provided (line 52 left-hand ?? branch)", () => {
    const session = repo.createSession({
      engine: "claude",
      source: "web",
      sourceRef: "web:effort",
      effortLevel: "high",
    });
    expect(session.effortLevel).toBe("high");
  });

  it("createSession preserves all optional fields when provided (various ?? branches)", () => {
    const session = repo.createSession({
      engine: "claude",
      source: "slack",
      sourceRef: "s:full",
      sessionKey: "sk:full",
      replyContext: { channel: "C123" },
      messageId: "msg-001",
      transportMeta: { foo: "bar" },
      employee: "alice",
      model: "claude-opus-4",
      title: "Test session",
      parentSessionId: "parent-001",
      effortLevel: "medium",
    });

    expect(session.replyContext).toEqual({ channel: "C123" });
    expect(session.messageId).toBe("msg-001");
    expect(session.transportMeta).toEqual({ foo: "bar" });
    expect(session.employee).toBe("alice");
    expect(session.model).toBe("claude-opus-4");
    expect(session.title).toBe("Test session");
    expect(session.parentSessionId).toBe("parent-001");
    expect(session.effortLevel).toBe("medium");
  });
});
