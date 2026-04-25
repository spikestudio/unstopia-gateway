import type { FileMeta, IFileRepository } from "./IFileRepository.js";

export class InMemoryFileRepository implements IFileRepository {
  private readonly store = new Map<string, FileMeta>();

  insertFile(meta: {
    id: string;
    filename: string;
    size: number;
    mimetype?: string | null;
    path?: string | null;
  }): FileMeta {
    const now = new Date().toISOString();
    const fileMeta: FileMeta = {
      id: meta.id,
      filename: meta.filename,
      size: meta.size,
      mimetype: meta.mimetype ?? null,
      path: meta.path ?? null,
      createdAt: now,
    };
    this.store.set(meta.id, fileMeta);
    return fileMeta;
  }

  getFile(id: string): FileMeta | undefined {
    return this.store.get(id);
  }

  listFiles(): FileMeta[] {
    return Array.from(this.store.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  deleteFile(id: string): boolean {
    return this.store.delete(id);
  }
}
