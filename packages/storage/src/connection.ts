import mysql from "mysql2/promise";

export interface StorageEnv {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function storageEnvFromProcess(): StorageEnv {
  const env = process.env;
  return {
    host: env.SEEKDB_HOST ?? "127.0.0.1",
    port: Number(env.SEEKDB_PORT ?? 2881),
    user: env.SEEKDB_USER ?? "root",
    password: env.SEEKDB_PASSWORD ?? "",
    database: env.SEEKDB_DATABASE ?? "multi_lang",
  };
}

export async function createConnection(
  env: StorageEnv,
): Promise<mysql.PoolConnection> {
  const pool = mysql.createPool({
    host: env.host,
    port: env.port,
    user: env.user,
    password: env.password,
    database: env.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
    multipleStatements: true,
    connectTimeout: 5000,
    // 库内时间戳一律为 UTC 字面量，禁止 mysql2 按进程时区二次换算
    timezone: "Z",
  });
  const conn = await pool.getConnection();
  conn.release();
  return conn;
}

export function createPool(env: StorageEnv): mysql.Pool {
  return mysql.createPool({
    host: env.host,
    port: env.port,
    user: env.user,
    password: env.password,
    database: env.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
    multipleStatements: true,
    connectTimeout: 5000,
    timezone: "Z",
  });
}
