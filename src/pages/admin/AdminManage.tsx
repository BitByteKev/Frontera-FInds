import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminApi, clearToken, getToken } from "../../lib/api";
import type { Item } from "../../lib/types";
import { formatDual, imgUrl } from "../../lib/format";
import { useRate } from "../../lib/currency";

export default function AdminManage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [xlating, setXlating] = useState<string | null>(null);
  const rate = useRate();

  function load() {
    adminApi.listAll()
      .then((r) => setItems(r.items))
      .catch((e) => {
        if (String(e).includes("unauthorized")) { clearToken(); navigate("/admin"); }
        else setError(String(e));
      });
  }
  useEffect(() => {
    if (!getToken()) { navigate("/admin"); return; }
    load();
  }, []);

  async function setStatus(it: Item, status: Item["status"]) {
    await adminApi.update(it.id, { status });
    load();
  }
  async function remove(it: Item) {
    if (!confirm(`Delete "${it.title}"?`)) return;
    await adminApi.remove(it.id);
    load();
  }
  async function translateAll() {
    setXlating("Translating…");
    try {
      // Backfill is batched server-side; loop until the server reports done.
      // Cap iterations as a safety net against an unexpected non-decreasing remaining.
      for (let i = 0; i < 1000; i++) {
        const r = await adminApi.translateAll();
        if (r.done) { setXlating("Done — all items translated."); break; }
        setXlating(`Translating… ${r.remaining} left`);
      }
      load();
    } catch (e) {
      setXlating(null);
      setError(String(e));
    }
  }

  return (
    <main className="ff-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Your items</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="ff-btn ff-btn-outline" to="/admin/dashboard">Dashboard</Link>
          <Link className="ff-btn ff-btn-green" to="/admin/new">+ New item</Link>
          <button className="ff-btn ff-btn-outline" onClick={translateAll} disabled={!!xlating && !xlating.startsWith("Done")}>
            {xlating ?? "Translate all items"}
          </button>
          <button className="ff-btn ff-btn-outline" onClick={() => { clearToken(); navigate("/admin"); }}>
            Log out
          </button>
        </div>
      </div>
      {error && <p style={{ color: "#a50e0e" }}>{error}</p>}
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {items.map((it) => (
          <div key={it.id} style={{ display: "flex", gap: 12, alignItems: "center",
            border: "1px solid var(--ff-line)", borderRadius: 10, padding: 8, background: "var(--ff-card)" }}>
            <img src={it.photoKeys[0] ? imgUrl(it.photoKeys[0]) : ""} alt=""
              style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, background: "var(--ff-sand)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{it.title}</div>
              <div style={{ color: "var(--ff-muted)", fontSize: 13 }}>
                {formatDual(it.priceCents, rate)} · {it.status}
              </div>
            </div>
            <Link className="ff-btn ff-btn-outline" to={`/admin/edit/${it.id}`}>Edit</Link>
            {it.status !== "sold"
              ? <button className="ff-btn ff-btn-outline" onClick={() => setStatus(it, "sold")}>Mark sold</button>
              : <button className="ff-btn ff-btn-outline" onClick={() => setStatus(it, "published")}>Relist</button>}
            <button className="ff-btn ff-btn-outline" onClick={() => remove(it)}>Delete</button>
          </div>
        ))}
        {items.length === 0 && <p>No items yet. Tap "New item" to add your first.</p>}
      </div>
    </main>
  );
}
