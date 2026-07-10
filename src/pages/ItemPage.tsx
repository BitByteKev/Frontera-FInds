import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Item } from "../lib/types";
import { formatDual } from "../lib/format";
import Badges from "../components/Badges";
import ContactButtons from "../components/ContactButtons";
import Gallery from "../components/Gallery";
import { useLang } from "../i18n/LanguageContext";
import { useRate } from "../lib/currency";
import { localizeItem } from "../lib/localize";
import reviewsData from "../data/reviews.json";

export default function ItemPage() {
  const { id } = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t, lang } = useLang();
  const rate = useRate();

  useEffect(() => {
    if (!id) return;
    api.get(id).then((r) => setItem(r.item)).catch(() => setError(t("item.notFound")));
  }, [id]);

  if (error) return <main className="ff-wrap"><p>{error}</p></main>;
  if (!item) return <main className="ff-wrap"><p>{t("common.loading")}</p></main>;

  const view = localizeItem(item, lang);

  return (
    <main className="ff-wrap" style={{ maxWidth: 760 }}>
      <Gallery photoKeys={view.photoKeys} title={view.title} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>{view.title}</h1>
        {view.status === "sold" && <span className="ff-badge-sold">{t("badge.sold")}</span>}
      </div>
      <div className="ff-price" style={{ fontSize: 24 }}>{formatDual(view.priceCents, rate)}</div>
      <Badges item={view} />
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{view.description}</p>
      {view.status === "sold"
        ? <p style={{ fontWeight: 700 }}>{t("item.soldNotice")}</p>
        : <ContactButtons item={view} />}
      <p style={{ marginTop: 14, fontSize: 14 }}>
        <Link to="/reviews">
          ★ {reviewsData.summary.rating} · {t("reviews.itemTrust", { count: String(reviewsData.summary.count) })}
        </Link>
      </p>
    </main>
  );
}
