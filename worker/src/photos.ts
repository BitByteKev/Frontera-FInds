import { Hono } from "hono";
import type { Env } from "./index";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const photos = new Hono<{ Bindings: Env }>();

// Serve an R2 object. ":key{.+}" captures slashes (e.g. items/abc.jpg).
photos.get("/img/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const obj = await c.env.PHOTOS.get(key);
  if (!obj) return c.notFound();
  const headers = new Headers();
  headers.set("content-type", obj.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", obj.httpEtag);
  return new Response(obj.body, { headers });
});

// Upload one or more photos (multipart field name: "file", repeatable).
// Admin guard is applied where this is mounted (Task 6).
photos.post("/api/admin/upload", async (c) => {
  const form = await c.req.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) return c.json({ error: "no_files" }, 400);

  const keys: string[] = [];
  for (const file of files) {
    const ext = EXT_BY_TYPE[file.type] ?? "bin";
    const key = `items/${crypto.randomUUID()}.${ext}`;
    await c.env.PHOTOS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
    keys.push(key);
  }
  return c.json({ keys });
});
