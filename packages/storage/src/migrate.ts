import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mysql from "mysql2/promise";
import { createStorage } from "./index.js";
import { storageEnvFromProcess, type StorageEnv } from "./connection.js";
import type { MySqlStorage } from "./storage.js";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

const RETRYABLE_CODES = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENOTFOUND",
  "PROTOCOL_CONNECTION_LOST",
]);
const RETRY_ATTEMPTS = 40;
const RETRY_DELAY_MS = 3000;

function errorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const code = (error as { code?: unknown }).code;
  return code === undefined ? "" : String(code);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDatabase(env: StorageEnv): Promise<void> {
  if (!/^[A-Za-z0-9_]+$/.test(env.database)) {
    throw new Error(`Invalid SEEKDB_DATABASE: ${env.database}`);
  }

  const connection = await mysql.createConnection({
    host: env.host,
    port: env.port,
    user: env.user,
    password: env.password,
    connectTimeout: 5000,
  });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.database}\` CHARACTER SET utf8mb4`,
    );
  } finally {
    await connection.end();
  }
}

async function connectWithRetry(env: StorageEnv): Promise<MySqlStorage> {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      await ensureDatabase(env);
      return await createStorage(env);
    } catch (error) {
      const code = errorCode(error);
      if (!RETRYABLE_CODES.has(code)) {
        throw new Error(
          `seekdb connection failed (${code || "unknown"}): ${errorMessage(error)}. ` +
            "Check SEEKDB_* values in .env and that seekdb is running.",
        );
      }
      if (attempt === RETRY_ATTEMPTS) {
        throw new Error(
          `seekdb did not become ready within ${(RETRY_ATTEMPTS * RETRY_DELAY_MS) / 1000}s: ${errorMessage(error)}`,
        );
      }
      console.log(
        `Waiting for seekdb... (${attempt}/${RETRY_ATTEMPTS})`,
      );
      await sleep(RETRY_DELAY_MS);
    }
  }
  throw new Error("unreachable");
}

export async function runMigrations(
  storage: MySqlStorage,
): Promise<string[]> {
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  await storage.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(64) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const applied: string[] = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const existing = await storage.query(
      "SELECT version FROM schema_migrations WHERE version = ?",
      [version],
    );
    if (existing.length > 0) continue;

    const sql = await readFile(join(migrationsDir, file), "utf8");
    await storage.query(sql);
    await storage.query(
      "INSERT INTO schema_migrations (version) VALUES (?)",
      [version],
    );
    applied.push(version);
  }
  return applied;
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const storage = await connectWithRetry(storageEnvFromProcess());
  try {
    const applied = await runMigrations(storage);
    console.log(
      applied.length > 0 ? `applied: ${applied.join(", ")}` : "up to date",
    );
  } finally {
    await storage.close();
  }
}
