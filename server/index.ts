/**
 * index.ts
 * -----------------------------------------------
 * Archivo principal del backend (Express + TypeScript).
 *
 * Que hace?
 * - Inicializa Express y configura middlewares basicos.
 * - Define endpoints (incluye healthchecks y auth).
 * - Arranca el servidor en el puerto configurado.
 *
 * Nota:
 * - La conexion a MariaDB se gestiona en /db/pool.ts.
 * - En desarrollo, si usas tunel SSH, DB_PORT debe ser 3307.
 */

import "dotenv/config";
import cors from "cors";
import crypto from "node:crypto";
import express from "express";
import type { Request, Response } from "express";
import { pool } from "./db/pool";

const app = express();

/**
 * Middleware: habilita CORS para el frontend.
 */
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "*",
  }),
);

/**
 * Middleware: permite que Express entienda JSON en el body.
 */
app.use(express.json());

/**
 * Middleware: permite recibir formularios simples (x-www-form-urlencoded).
 */
app.use(express.urlencoded({ extended: true }));

type LoginBody = {
  tenant?: string;
  email?: string;
  password?: string;
};

type RegisterBody = {
  tenant?: string;
  name?: string;
  email?: string;
  phone?: string;
  country_code?: string;
  password?: string;
};

/**
 * Normaliza strings desde body para evitar undefined y espacios extra.
 */
function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Permite "activo"/"active"/"enabled" y deja pasar vacio.
 */
function isActiveStatus(value: unknown) {
  const v = toCleanString(value).toLowerCase();
  if (!v) return true;
  return v === "activo" || v === "active" || v === "enabled";
}

/**
 * Devuelve la clave AES de 32 bytes desde env si existe.
 */
function getAesKey() {
  const raw = process.env.PASSWORD_KEY;
  if (!raw) return null;

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  if (/^[A-Za-z0-9+/=]+$/.test(raw)) {
    const buffer = Buffer.from(raw, "base64");
    if (buffer.length === 32) return buffer;
  }

  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) return utf8;

  return null;
}

/**
 * Encripta el password usando AES-256-GCM en formato iv:tag:cipher.
 */
function encryptPassword(plain: string) {
  const key = getAesKey();
  if (!key) {
    throw new Error("PASSWORD_KEY no configurado o invalido.");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Desencripta un password cifrado con AES-256-GCM.
 */
function decryptPassword(payload: string) {
  const parts = payload.split(":");
  if (parts.length !== 3) return null;

  const [ivHex, tagHex, dataHex] = parts;
  if (!ivHex || !tagHex || !dataHex) return null;

  const key = getAesKey();
  if (!key) return null;

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Comparacion segura de strings para credenciales.
 */
function timingSafeEqualString(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Valida password vs hash. Si no hay formato AES, compara texto plano.
 */
function verifyPassword(plain: string, stored: string) {
  if (!stored) return false;
  if (stored.includes(":")) {
    const decrypted = decryptPassword(stored);
    if (decrypted === null) return false;
    return timingSafeEqualString(plain, decrypted);
  }

  return timingSafeEqualString(plain, stored);
}

/**
 * Detecta error de columna inexistente para fallback.
 */
function isBadFieldError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const message = String((error as { message?: string } | null)?.message || "");
  return code === "ER_BAD_FIELD_ERROR" || message.includes("Unknown column");
}

/**
 * Ruta base (ping rapido).
 */
app.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "backend", message: "Backend funcionando" });
});

/**
 * Healthcheck de base de datos.
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
 * Healthcheck identificable del servidor remoto.
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
 * Login de usuarios por tenant, email y password.
 */
app.post("/auth/login", async (req: Request, res: Response) => {
  const body = req.body as LoginBody;
  const tenant = toCleanString(body?.tenant);
  const email = toCleanString(body?.email).toLowerCase();
  const password = toCleanString(body?.password);

  if (!tenant || !email || !password) {
    res.status(400).json({ ok: false, error: "Faltan campos." });
    return;
  }

  try {
    const conn = await pool.getConnection();
    try {
      const r = await conn.query(
        `SELECT u.id,
                u.name,
                u.email,
                u.role,
                u.status AS user_status,
                u.password_hash,
                u.tenant_id,
                t.status AS tenant_status
           FROM users u
           JOIN tenants t ON t.id = u.tenant_id
          WHERE u.email = ? AND u.tenant_id = ?
          LIMIT 1`,
        [email, tenant],
      );

      const rows = r[0] as Array<Record<string, unknown>>;
      const user = rows?.[0];

      if (!user) {
        res.status(401).json({ ok: false, error: "Credenciales invalidas." });
        return;
      }

      if (!isActiveStatus(user.user_status) || !isActiveStatus(user.tenant_status)) {
        res
          .status(403)
          .json({ ok: false, error: "Usuario o tenant desactivado." });
        return;
      }

      const stored = String(user.password_hash ?? "");
      const isValid = verifyPassword(password, stored);

      if (!isValid) {
        res.status(401).json({ ok: false, error: "Credenciales invalidas." });
        return;
      }

      try {
        await conn.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [
          user.id,
        ]);
      } catch {
        // Si el campo no existe no debe romper el login.
      }

      res.json({
        ok: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenant_id: user.tenant_id,
        },
      });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "Error interno." });
  }
});

/**
 * Registro basico de usuarios para un tenant existente.
 */
app.post("/auth/register", async (req: Request, res: Response) => {
  const body = req.body as RegisterBody;
  const tenant = toCleanString(body?.tenant);
  const name = toCleanString(body?.name);
  const email = toCleanString(body?.email).toLowerCase();
  const phone = toCleanString(body?.phone);
  const countryCode = toCleanString(body?.country_code);
  const password = toCleanString(body?.password);

  if (!tenant || !name || !email || !password) {
    res.status(400).json({ ok: false, error: "Faltan campos." });
    return;
  }

  if (!email.includes("@")) {
    res.status(400).json({ ok: false, error: "Email invalido." });
    return;
  }

  try {
    const conn = await pool.getConnection();
    try {
      const tenantResult = await conn.query(
        "SELECT id, status FROM tenants WHERE id = ? LIMIT 1",
        [tenant],
      );
      const tenantRows = tenantResult[0] as Array<Record<string, unknown>>;
      const tenantRow = tenantRows?.[0];

      if (!tenantRow) {
        res.status(404).json({ ok: false, error: "Tenant no encontrado." });
        return;
      }

      if (!isActiveStatus(tenantRow.status)) {
        res.status(403).json({ ok: false, error: "Tenant desactivado." });
        return;
      }

      const userResult = await conn.query(
        "SELECT id FROM users WHERE tenant_id = ? AND email = ? LIMIT 1",
        [tenant, email],
      );
      const userRows = userResult[0] as Array<Record<string, unknown>>;
      const existing = userRows?.[0];

      if (existing) {
        res.status(409).json({ ok: false, error: "Usuario ya registrado." });
        return;
      }

      const passwordHash = encryptPassword(password);
      const status = "activo";
      const role = "user";
      const inserts = [
        {
          sql: "INSERT INTO users (tenant_id, name, email, phone, country_code, password_hash, status, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          params: [
            tenant,
            name,
            email,
            phone || null,
            countryCode || null,
            passwordHash,
            status,
            role,
          ],
        },
        {
          sql: "INSERT INTO users (tenant_id, name, email, phone, password_hash, status, role) VALUES (?, ?, ?, ?, ?, ?, ?)",
          params: [tenant, name, email, phone || null, passwordHash, status, role],
        },
        {
          sql: "INSERT INTO users (tenant_id, name, email, password_hash, status, role) VALUES (?, ?, ?, ?, ?, ?)",
          params: [tenant, name, email, passwordHash, status, role],
        },
        {
          sql: "INSERT INTO users (tenant_id, email, password_hash, status, role) VALUES (?, ?, ?, ?, ?)",
          params: [tenant, email, passwordHash, status, role],
        },
      ];

      let inserted = false;

      for (const insert of inserts) {
        try {
          await conn.query(insert.sql, insert.params);
          inserted = true;
          break;
        } catch (error) {
          if (!isBadFieldError(error)) {
            throw error;
          }
        }
      }

      if (!inserted) {
        throw new Error("No se pudo insertar el usuario.");
      }

      res.json({ ok: true });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "Error interno." });
  }
});

/**
 * 404 generico para rutas no definidas.
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: "Ruta no encontrada" });
});

/**
 * Puerto del servidor.
 */
const PORT = Number(process.env.PORT || 3001);

/**
 * Arranque del servidor.
 */
app.listen(PORT, () => {
  console.log(`Backend listo en http://localhost:${PORT}`);
});
