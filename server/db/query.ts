/**
 * db/query.ts
 * -----------------------------------------------
 * Helper para ejecutar consultas SQL sin repetir boilerplate.
 *
 * ¿Para qué sirve?
 * - Pide una conexión al pool
 * - Ejecuta la query con parámetros
 * - Libera la conexión SIEMPRE (incluso si hay error)
 *
 * Uso:
 *   import { query } from "./db/query";
 *   const rows = await query("SELECT 1");
 */

import { pool } from "./pool";

/**
 * Ejecuta una consulta SQL usando el pool.
 * @param sql Query SQL (puede incluir placeholders ?)
 * @param params Parámetros para los placeholders
 * @returns Resultado devuelto por mariadb (normalmente un array de filas)
 */
export async function query<T = any>(sql: string, params: any[] = []) {
  const conn = await pool.getConnection(); // 1) obtener conexión
  try {
    const rows = await conn.query(sql, params); // 2) ejecutar query
    return rows as T;
  } finally {
    conn.release(); // 3) liberar siempre
  }
}
