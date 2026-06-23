import type { Item, SiteConfig } from "./types";

const TOKEN_KEY = "ff_admin_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `http_${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  config: () => fetch("/api/config").then((r) => json<SiteConfig>(r)),
  fx: () => fetch("/api/fx").then((r) => json<{ rate: number }>(r)),
  list: (params: URLSearchParams) => fetch(`/api/items?${params}`).then((r) => json<{ items: Item[] }>(r)),
  get: (id: string) => fetch(`/api/items/${id}`).then((r) => json<{ item: Item }>(r)),
  contact: (id: string, body: { name?: string; message: string; replyTo?: string }) =>
    fetch(`/api/items/${id}/contact`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }).then((r) => json<{ ok: true }>(r)),
};

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...extra, authorization: `Bearer ${getToken() ?? ""}` };
}

export const adminApi = {
  login: (password: string) =>
    fetch("/api/admin/login", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }),
    }).then((r) => json<{ token: string }>(r)),
  listAll: () => fetch("/api/admin/items", { headers: authHeaders() }).then((r) => json<{ items: Item[] }>(r)),
  listPhotos: () => fetch("/api/admin/photos", { headers: authHeaders() }).then((r) => json<{ keys: string[] }>(r)),
  upload: (files: File[]) => {
    const fd = new FormData();
    for (const f of files) fd.append("file", f);
    return fetch("/api/admin/upload", { method: "POST", headers: authHeaders(), body: fd })
      .then((r) => json<{ keys: string[] }>(r));
  },
  generate: (keys: string[]) =>
    fetch("/api/admin/generate", {
      method: "POST", headers: authHeaders({ "content-type": "application/json" }), body: JSON.stringify({ keys }),
    }).then((r) => json<{ title: string; description: string; priceCents: number }>(r)),
  create: (body: Partial<Item>) =>
    fetch("/api/admin/items", {
      method: "POST", headers: authHeaders({ "content-type": "application/json" }), body: JSON.stringify(body),
    }).then((r) => json<{ id: string }>(r)),
  update: (id: string, body: Partial<Item>) =>
    fetch(`/api/admin/items/${id}`, {
      method: "PATCH", headers: authHeaders({ "content-type": "application/json" }), body: JSON.stringify(body),
    }).then((r) => json<{ ok: true }>(r)),
  remove: (id: string) =>
    fetch(`/api/admin/items/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => json<{ ok: true }>(r)),
};
