import { Hono } from "hono";

export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  SEND_EMAIL: SendEmail;
  ANTHROPIC_API_KEY: string;
  ADMIN_PASSWORD: string;
  AI_MODEL: string;
  PUBLIC_WHATSAPP: string;
  PUBLIC_SMS: string;
  PUBLIC_INSTAGRAM_URL: string;
  OWNER_EMAIL: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

export default app;
