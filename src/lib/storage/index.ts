import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Storage abstraction for raw downloaded documents (spec section 33: never
 * discard the original source material). The pipeline only ever talks to
 * this interface, so swapping "local" for an S3-compatible driver later is a
 * config change, not a rewrite.
 */
export interface StorageDriver {
  /** Persist raw bytes, return a driver-specific reference (path or object key) usable later to read it back. */
  put(key: string, data: Buffer): Promise<string>;
}

class LocalStorageDriver implements StorageDriver {
  constructor(private readonly rootDir: string) {}

  async put(key: string, data: Buffer): Promise<string> {
    const fullPath = path.join(this.rootDir, key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
    return fullPath;
  }
}

let cachedDriver: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (cachedDriver) return cachedDriver;

  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver !== "local") {
    throw new Error(
      `STORAGE_DRIVER="${driver}" is not implemented yet. Only "local" exists today; implement StorageDriver for S3/GCS and wire it in here when needed.`
    );
  }

  cachedDriver = new LocalStorageDriver(process.env.STORAGE_LOCAL_DIR ?? "./storage");
  return cachedDriver;
}
