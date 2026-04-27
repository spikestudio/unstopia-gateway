import type Database from "better-sqlite3";
import type { FileMeta, IFileRepository } from "./IFileRepository.js";

function rowToFileMeta(row: Record<string, unknown>): FileMeta {
  return {
    id: row.id as string,
    filename: row.filename as string,
    size: row.size as number,
    mimetype: (row.mimetype as string) ?? null,
    path: (row.path as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export class SqliteFileRepository implements IFileRepository {
  constructor(private readonly db: Database.Database) {}

  insertFile(meta: {
    id: string;
    filename: string;
    size: number;
    mimetype?: string | null;
    path?: string | null;
  }): FileMeta {
    const now = new Date().toISOString();
    this.db
      .prepare("INSERT INTO files (id, filename, size, mimetype, path, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(meta.id, meta.filename, meta.size, meta.mimetype ?? null, meta.path ?? null, now);
    return {
      id: meta.id,
      filename: meta.filename,
      size: meta.size,
      mimetype: meta.mimetype ?? null,
      path: meta.path ?? null,
      createdAt: now,
    };
  }

  getFile(id: string): FileMeta | undefined {
    const row = this.db.prepare("SELECT * FROM files WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? rowToFileMeta(row) : undefined;
  }

  listFiles(): FileMeta[] {
    const rows = this.db.prepare("SELECT * FROM files ORDER BY created_at DESC").all() as Record<string, unknown>[];
    return rows.map(rowToFileMeta);
  }

  deleteFile(id: string): boolean {
    const result = this.db.prepare("DELETE FROM files WHERE id = ?").run(id);
    return result.changes > 0;
  }
}
