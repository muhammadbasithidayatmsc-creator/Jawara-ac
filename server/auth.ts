import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { getDataDir, getDb } from './db.ts';

export const SESSION_COOKIE_NAME = 'jawara_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari
let cachedFallbackSecret: string | null = null;

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }
  if (cachedFallbackSecret) {
    return cachedFallbackSecret;
  }

  const secretPath = path.join(getDataDir(), '.session_secret');
  try {
    fs.mkdirSync(getDataDir(), { recursive: true });
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, 'utf8').trim();
      if (existing.length >= 32) {
        cachedFallbackSecret = existing;
        return existing;
      }
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    cachedFallbackSecret = generated;
    return generated;
  } catch {
    cachedFallbackSecret = crypto.randomBytes(32).toString('hex');
    return cachedFallbackSecret;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  if (!salt || !originalHex) return false;
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  const originalBuf = Buffer.from(originalHex, 'hex');
  if (derivedBuf.length !== originalBuf.length) return false;
  return crypto.timingSafeEqual(derivedBuf, originalBuf);
}

export interface SessionPayload {
  sub: string;
  email: string;
  exp: number;
}

export function signSessionToken(adminId: string, email: string): string {
  const payload: SessionPayload = {
    sub: adminId,
    email,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const a = Buffer.from(providedSig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload?.sub || !payload?.email || typeof payload.exp !== 'number') {
      return null;
    }
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    maxAge: SESSION_TTL_MS,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    path: '/',
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
}

function extractSessionToken(req: Request): string {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }

  const cookieHeader = req.headers.cookie || '';
  if (!cookieHeader) return '';
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key === SESSION_COOKIE_NAME) {
      try {
        return decodeURIComponent(part.slice(eqIdx + 1).trim());
      } catch {
        return part.slice(eqIdx + 1).trim();
      }
    }
  }
  return '';
}

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminRequest extends Request {
  admin?: AuthenticatedAdmin;
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction): void {
  const token = extractSessionToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sesi login diperlukan. Silakan masuk sebagai Admin.' });
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.' });
    return;
  }

  const db = getDb();
  const row = db
    .prepare(
      'SELECT id, email, full_name, phone, role, is_active, created_at, updated_at FROM admins WHERE id = ? AND is_active = 1'
    )
    .get(payload.sub) as
    | {
        id: string;
        email: string;
        full_name: string;
        phone: string;
        role: 'admin';
        is_active: number;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!row) {
    res.status(401).json({ error: 'Akun Admin tidak ditemukan atau sudah dinonaktifkan.' });
    return;
  }

  req.admin = {
    ...row,
    is_active: Boolean(row.is_active),
  };
  next();
}
