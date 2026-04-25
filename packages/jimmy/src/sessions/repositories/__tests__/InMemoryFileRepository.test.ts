import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryFileRepository } from "../InMemoryFileRepository.js";

describe("AC-6 InMemoryFileRepository", () => {
  let repo: InMemoryFileRepository;

  beforeEach(() => {
    repo = new InMemoryFileRepository();
  });

  it("AC-6: insertFile でファイルメタを登録できる", () => {
    const meta = repo.insertFile({
      id: "file-1",
      filename: "test.txt",
      size: 1024,
      mimetype: "text/plain",
      path: "/tmp/test.txt",
    });

    expect(meta.id).toBe("file-1");
    expect(meta.filename).toBe("test.txt");
    expect(meta.size).toBe(1024);
    expect(meta.mimetype).toBe("text/plain");
    expect(meta.createdAt).toBeDefined();
  });

  it("AC-6: getFile で登録済みファイルを取得できる", () => {
    repo.insertFile({ id: "file-2", filename: "img.png", size: 2048 });
    const found = repo.getFile("file-2");
    expect(found).toBeDefined();
    expect(found?.filename).toBe("img.png");
  });

  it("AC-6: listFiles で登録済みファイル一覧を取得できる", () => {
    repo.insertFile({ id: "file-3", filename: "a.txt", size: 100 });
    repo.insertFile({ id: "file-4", filename: "b.txt", size: 200 });

    const files = repo.listFiles();
    expect(files).toHaveLength(2);
  });

  it("AC-6: deleteFile でファイルを削除できる", () => {
    repo.insertFile({ id: "file-5", filename: "del.txt", size: 50 });
    const deleted = repo.deleteFile("file-5");
    expect(deleted).toBe(true);
    expect(repo.getFile("file-5")).toBeUndefined();
  });

  it("AC-6: 存在しないファイルの削除は false を返す", () => {
    const result = repo.deleteFile("nonexistent");
    expect(result).toBe(false);
  });
});
