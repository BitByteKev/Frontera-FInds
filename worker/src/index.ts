import { Hono } from "hono";
import { publicItems, adminItems } from "./items";
import { photos } from "./photos";
import { auth } from "./auth";
import { generate } from "./generate";
import { contact } from "./contact";

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
app.get("/api/config", (c) =>
  c.json({
    whatsapp: c.env.PUBLIC_WHATSAPP,
    sms: c.env.PUBLIC_SMS,
    instagramUrl: c.env.PUBLIC_INSTAGRAM_URL,
  })
);
app.route("/", publicItems);
app.route("/", adminItems);
app.route("/", photos);
app.route("/", auth);
app.route("/", generate);
app.route("/", contact);

export default app;
