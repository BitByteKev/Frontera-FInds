import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Item } from "../lib/types";
import ItemCard from "../components/ItemCard";

export default function Home() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ships = params.get("ships") === "1";
  const local = params.get("local") === "1";

  useEffect(() => {
    setLoading(true);
    api.list(params)
      .then((r) => { setItems(r.items); setError(null); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [params]);

  function toggle(key: "ships" | "local") {
    const next = new URLSearchParams(params);
    if (next.get(key) === "1") next.delete(key);
    else next.set(key, "1");
    setParams(next);
  }

  return (
    <>
    <div className="ff-hero">
      <div className="ff-hero-tag">
        <b>Two cities. One marketplace.</b>
        <i>El swapmeet sin fronteras</i>
      </div>
      <span className="ff-pill">
        San Diego <span className="ff-arrow">⟷</span> Tijuana
        <span className="ff-dot" /> Shipping across the USA
      </span>
    </div>
    <main className="ff-wrap">
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button className={ships ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("ships")}>
          Ships USA
        </button>
        <button className={local ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("local")}>
          Local pickup / delivery
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "#a50e0e" }}>Couldn't load items: {error}</p>}
      {!loading && !error && items.length === 0 && <p>No items yet — check back soon.</p>}

      <div className="ff-grid">
        {items.map((it) => <ItemCard key={it.id} item={it} />)}
      </div>
    </main>
    </>
  );
}
