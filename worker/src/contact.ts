import { Hono } from "hono";
import { EmailMessage } from "cloudflare:email";
import { createMimeMessage, Mailbox } from "mimetext/browser";
import type { Env } from "./index";
import type { ItemRow } from "./db";

export const contact = new Hono<{ Bindings: Env }>();

contact.post("/api/items/:id/contact", async (c) => {
  const id = c.req.param("id");
  const { name, message, replyTo } = await c.req.json<{ name?: string; message?: string; replyTo?: string }>();
  if (!message || !message.trim()) return c.json({ error: "message_required" }, 400);

  const item = await c.env.DB.prepare(`SELECT * FROM items WHERE id = ?1`).bind(id).first<ItemRow>();
  if (!item) return c.json({ error: "not_found" }, 404);

  const validReplyTo = replyTo && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(replyTo) ? replyTo : undefined;

  try {
    const msg = createMimeMessage();
    msg.setSender({ name: "Frontera Finds", addr: c.env.OWNER_EMAIL });
    msg.setRecipient(c.env.OWNER_EMAIL);
    // Reply-To is an address header in mimetext — it must be a mailbox object,
    // not a bare string (a string throws MIMETEXT_INVALID_HEADER_VALUE).
    if (validReplyTo) msg.setHeader("Reply-To", new Mailbox(validReplyTo));
    msg.setSubject(`Frontera Finds inquiry: ${item.title}`);
    msg.addMessage({
      contentType: "text/plain",
      data:
        `New inquiry on "${item.title}" (id ${item.id})\n\n` +
        `From: ${name?.trim() || "Anonymous"}\n` +
        (validReplyTo ? `Reply-to: ${validReplyTo}\n` : "") +
        `\nMessage:\n${message.trim()}\n`,
    });

    const email = new EmailMessage(c.env.OWNER_EMAIL, c.env.OWNER_EMAIL, msg.asRaw());
    await c.env.SEND_EMAIL.send(email);
    return c.json({ ok: true });
  } catch (err) {
    // Public endpoint: don't leak internal error detail to buyers; log it instead.
    console.error("contact email failed", err);
    return c.json({ error: "email_failed" }, 502);
  }
});
