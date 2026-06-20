import { Link } from "react-router-dom";
import type { Item } from "../lib/types";
import { money, imgUrl } from "../lib/format";
import Badges from "./Badges";

export default function ItemCard({ item }: { item: Item }) {
  return (
    <Link to={`/item/${item.slug}`} className="ff-card">
      <div className="ff-card-media">
        <img
          className={item.status === "sold" ? "ff-card-img ff-card-img-sold" : "ff-card-img"}
          src={item.photoKeys[0] ? imgUrl(item.photoKeys[0]) : ""}
          alt={item.title}
          loading="lazy"
        />
        {item.status === "sold" && <span className="ff-card-sold">SOLD</span>}
      </div>
      <div className="ff-card-body">
        <div className="ff-card-title">{item.title}</div>
        <div className="ff-price">{money(item.priceCents)}</div>
        <Badges item={item} />
      </div>
    </Link>
  );
}
