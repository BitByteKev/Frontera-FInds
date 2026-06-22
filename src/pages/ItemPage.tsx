import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Item } from "../lib/types";
import { money } from "../lib/format";
import Badges from "../components/Badges";
import ContactButtons from "../components/ContactButtons";
import Gallery from "../components/Gallery";
import { useLang } from "../i18n/LanguageContext";

export default function ItemPage() {
  const { id } = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLang();

  useEffect(() => {
    if (!id) return;
    api.get(id).then((r) => setItem(r.item)).catch(() => setError(t("item.notFound")));
  }, [id]);

  if (error) return <main className="ff-wrap"><p>{error}</p></main>;
  if (!item) return <main className="ff-wrap"><p>{t("common.loading")}</p></main>;

  return (
    <main className="ff-wrap" style={{ maxWidth: 760 }}>
      <Gallery photoKeys={item.photoKeys} title={item.title} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>{item.title}</h1>
        {item.status === "sold" && <span className="ff-badge-sold">{t("badge.sold")}</span>}
      </div>
      <div className="ff-price" style={{ fontSize: 24 }}>{money(item.priceCents)}</div>
      <Badges item={item} />
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{item.description}</p>
      {item.status === "sold"
        ? <p style={{ fontWeight: 700 }}>{t("item.soldNotice")}</p>
        : <ContactButtons item={item} />}
    </main>
  );
}
