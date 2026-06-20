import { Hono } from "hono";
import type { Context, Next } from "hono";
import type { Env } from "./index";

const enc = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

async function hmac(password: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signToken(password: string, exp: number): Promise<string> {
  const payload = b64urlEncode(enc.encode(JSON.stringify({ exp })));
  const sig = b64urlEncode(await hmac(password, payload));
  return `${payload}.${sig}`;
}

export async function verifyToken(password: string, token: string): Promise<boolean> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  try {
    const expected = await hmac(password, payload);
    if (!timingSafeEqual(b64urlDecode(sig), expected)) return false;
    const { exp } = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export const auth = new Hono<{ Bindings: Env }>();

auth.post("/api/admin/login", async (c) => {
  const body = await c.req.json<{ password?: string }>().catch(() => ({}));
  const { password } = body as { password?: string };
  if (!password || password !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: "invalid_password" }, 401);
  }
  const token = await signToken(c.env.ADMIN_PASSWORD, Date.now() + SEVEN_DAYS);
  return c.json({ token });
});

// Middleware: require a valid Bearer token on admin write routes.
// Typed as Hono's MiddlewareHandler so it can be used directly as
// someHono.use("/path/*", requireAdmin) in Task 6.
export const requireAdmin = async (
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response | void> => {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !(await verifyToken(c.env.ADMIN_PASSWORD, token))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
};
