/**
 * index.ts
 * -----------------------------------------------
 * Archivo principal del backend (Express + TypeScript).
 *
 * ¿Qué hace?
 * - Inicializa Express y configura middlewares básicos.
 * - Define endpoints (incluye un healthcheck de DB).
 * - Arranca el servidor en el puerto configurado.
 *
 * Nota:
 * - La conexión a MariaDB se gestiona en /db/pool.ts mediante un pool reutilizable.
 * - En desarrollo, si usas túnel SSH, tu .env debería apuntar a DB_PORT=3307.
 */

import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { pool } from "./db/pool";

const app = express();

/**
 * Middleware: permite que Express entienda JSON en el body.
 * (Ej: POST/PUT con req.body)
 */
app.use(express.json());

/**
 * Middleware: permite recibir formularios simples (x-www-form-urlencoded).
 * (Opcional, pero útil en algunos casos)
 */
app.use(express.urlencoded({ extended: true }));

/**
 * Ruta base (ping rápido)
 * Sirve para comprobar que el backend está levantado.
 */
app.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "backend", message: "✅ Backend funcionando" });
});

/**
 * Healthcheck de base de datos
 * Devuelve ok:true si puede conectarse y ejecutar una consulta simple.
 * Si falla (túnel cerrado, credenciales mal, DB caída), devuelve ok:false + error.
 */
app.get("/health/db", async (_req: Request, res: Response) => {
  try {
    const conn = await pool.getConnection();
    const r = await conn.query("SELECT 1 AS ok");
    conn.release();

    res.json({ ok: true, db: r[0] });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

/**
 * (Opcional) Healthcheck más “identificable” del servidor remoto:
 * Muestra hostname/puerto/DB actual para confirmar que estás en el VPS.
 * Puedes borrarlo cuando ya no lo necesites.
 */
app.get("/health/db-info", async (_req: Request, res: Response) => {
  try {
    const conn = await pool.getConnection();
    const r = await conn.query(
      "SELECT @@hostname AS host, @@port AS port, DATABASE() AS db",
    );
    conn.release();

    res.json({ ok: true, info: r[0] });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

/**
 * 404 genérico para rutas no definidas
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: "Ruta no encontrada" });
});

/**
 * Puerto del servidor:
 * - Usa PORT desde .env si existe
 * - Si no, por defecto 3001
 */
const PORT = Number(process.env.PORT || 3001);

/**
 * Arranque del servidor
 */
app.listen(PORT, () => {
  console.log(`✅ Backend listo en http://localhost:${PORT}`);
});
