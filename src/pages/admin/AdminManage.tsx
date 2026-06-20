import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminApi, clearToken, getToken } from "../../lib/api";
import type { Item } from "../../lib/types";
import { money, imgUrl } from "../../lib/format";

export default function AdminManage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="ff-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Your items</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="ff-btn ff-btn-green" to="/admin/new">+ New item</Link>
          <button className="ff-btn ff-btn-outline" onClick={() => { clearToken(); navigate("/admin"); }}>
            Log out
          </button>
        </div>
      </div>
      {error && <p style={{ color: "#a50e0e" }}>{error}</p>}
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {items.map((it) => (
          <div key={it.id} style={{ display: "flex", gap: 12, alignItems: "center",
            border: "1px solid var(--ff-line)", borderRadius: 10, padding: 8, background: "#fff" }}>
            <img src={it.photoKeys[0] ? imgUrl(it.photoKeys[0]) : ""} alt=""
              style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, background: "#f0ead9" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{it.title}</div>
              <div style={{ color: "var(--ff-muted)", fontSize: 13 }}>
                {money(it.priceCents)} · {it.status}
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
