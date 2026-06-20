import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Item } from "../lib/types";
import { money } from "../lib/format";
import Badges from "../components/Badges";
import ContactButtons from "../components/ContactButtons";
import Gallery from "../components/Gallery";

export default function ItemPage() {
  const { id } = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get(id).then((r) => setItem(r.item)).catch(() => setError("Item not found."));
  }, [id]);

  if (error) return <main className="ff-wrap"><p>{error}</p></main>;
  if (!item) return <main className="ff-wrap"><p>Loading…</p></main>;

  return (
    <main className="ff-wrap" style={{ maxWidth: 760 }}>
      <Gallery photoKeys={item.photoKeys} title={item.title} />
      <h1 style={{ marginBottom: 4 }}>{item.title}</h1>
      <div className="ff-price" style={{ fontSize: 24 }}>{money(item.priceCents)}</div>
      <Badges item={item} />
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{item.description}</p>
      {item.status === "sold"
        ? <p style={{ fontWeight: 700 }}>This item has been sold.</p>
        : <ContactButtons item={item} />}
    </main>
  );
}
