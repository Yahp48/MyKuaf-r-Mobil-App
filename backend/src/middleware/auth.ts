import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.ts";
import { forbidden, unauthorized } from "../lib/errors.ts";
import type { Role } from "../generated/prisma/enums.ts";

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface AccessPayload {
  sub: string;
  role: Role;
  typ: "access";
}

export function signAccessToken(user: AuthUser): string {
  const payload: AccessPayload = { sub: user.id, role: user.role, typ: "access" };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    algorithm: "HS256",
    issuer: "bakimca",
    audience: "bakimca-app",
  });
}

export function verifyAccessToken(token: string): AuthUser {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"],
    issuer: "bakimca",
    audience: "bakimca-app",
  }) as AccessPayload;
  if (decoded.typ !== "access" || typeof decoded.sub !== "string") throw new Error("invalid token");
  return { id: decoded.sub, role: decoded.role };
}

function readBearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7).trim() || undefined;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (!token) return next(unauthorized());
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(unauthorized("Oturum süresi doldu, lütfen tekrar giriş yapın"));
  }
}

/** Token varsa kullanıcıyı çözer, yoksa misafir olarak devam eder. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (token) {
    try {
      req.user = verifyAccessToken(token);
    } catch {
      return next(unauthorized("Oturum süresi doldu, lütfen tekrar giriş yapın"));
    }
  }
  next();
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role !== role) return next(forbidden());
    next();
  };
}

/** requireAuth sonrası kullanılır; tip güvenli kullanıcı kimliği. */
export function userId(req: Request): string {
  if (!req.user) throw unauthorized();
  return req.user.id;
}
