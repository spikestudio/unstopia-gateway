export interface FileMeta {
  id: string;
  filename: string;
  size: number;
  mimetype: string | null;
  path: string | null;
  createdAt: string;
}

export interface IFileRepository {
  insertFile(meta: { id: string; filename: string; size: number; mimetype?: string | null; path?: string | null }): FileMeta;
  getFile(id: string): FileMeta | undefined;
  listFiles(): FileMeta[];
  deleteFile(id: string): boolean;
}
