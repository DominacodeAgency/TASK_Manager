/**
 * db/pool.ts
 * -----------------------------------------------
 * Crea y exporta un pool de conexiones a MySQL/MariaDB usando mysql2 (promises).
 *
 * ¿Para qué sirve?
 * - Centraliza config DB (env)
 * - Reutiliza conexiones
 * - Evita boilerplate en cada consulta
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const required = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`❌ Falta ${name} en server/.env`);
  return v;
};

export const pool = mysql.createPool({
  host: required("DB_HOST"),
  port: Number(required("DB_PORT")),
  user: required("DB_USER"),
  password: required("DB_PASS"),
  database: required("DB_NAME"),
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});
