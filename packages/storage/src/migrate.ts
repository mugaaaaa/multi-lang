import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createStorage } from "./index.js";
import type { MySqlStorage } from "./storage.js";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

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
  const storage = await createStorage();
  try {
    const applied = await runMigrations(storage);
    console.log(
      applied.length > 0 ? `applied: ${applied.join(", ")}` : "up to date",
    );
  } finally {
    await storage.close();
  }
}
