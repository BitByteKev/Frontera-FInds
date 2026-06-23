import { Link } from "react-router-dom";
import type { Item } from "../lib/types";
import { formatDual, imgUrl } from "../lib/format";
import Badges from "./Badges";
import { useLang } from "../i18n/LanguageContext";
import { useRate } from "../lib/currency";

export default function ItemCard({ item }: { item: Item }) {
  const { t } = useLang();
  const rate = useRate();
  return (
    <Link to={`/item/${item.slug}`} className="ff-card">
      <div className="ff-card-media">
        <img
          className={item.status === "sold" ? "ff-card-img ff-card-img-sold" : "ff-card-img"}
          src={item.photoKeys[0] ? imgUrl(item.photoKeys[0]) : ""}
          alt={item.title}
          loading="lazy"
        />
        {item.status === "sold" && <span className="ff-card-sold">{t("badge.sold")}</span>}
      </div>
      <div className="ff-card-body">
        <div className="ff-card-title">{item.title}</div>
        <div className="ff-price">{formatDual(item.priceCents, rate)}</div>
        <Badges item={item} />
      </div>
    </Link>
  );
}
