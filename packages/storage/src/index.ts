import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mysql from "mysql2/promise";
import { createPool, storageEnvFromProcess, type StorageEnv } from "./connection.js";

// .env 位于仓库根目录
config({ path: join(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
import { MySqlStorage } from "./storage.js";

export async function createStorage(
  env: StorageEnv = storageEnvFromProcess(),
): Promise<MySqlStorage> {
  const pool = createPool(env);
  await pool.query("SELECT 1");
  return new MySqlStorage(pool);
}

export type { StorageEnv };
export { storageEnvFromProcess };
export type * from "@multi-lang/domain";
