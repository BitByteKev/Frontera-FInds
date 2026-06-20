import { Link } from "react-router-dom";
import type { Item } from "../lib/types";
import { money, imgUrl } from "../lib/format";
import Badges from "./Badges";

export default function ItemCard({ item }: { item: Item }) {
  return (
    <Link to={`/item/${item.id}`} className="ff-card">
      <img
        className="ff-card-img"
        src={item.photoKeys[0] ? imgUrl(item.photoKeys[0]) : ""}
        alt={item.title}
        loading="lazy"
      />
      <div className="ff-card-body">
        <div className="ff-card-title">{item.title}</div>
        <div className="ff-price">{money(item.priceCents)}</div>
        <Badges item={item} />
      </div>
    </Link>
  );
}
