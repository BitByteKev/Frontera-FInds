import type { Item } from "../lib/types";

export default function Badges({ item }: { item: Item }) {
  return (
    <div className="ff-badges">
      {item.status === "sold" && <span className="ff-sold-ribbon">SOLD</span>}
      {item.shipsUsa && <span className="ff-badge ff-badge-ship">Ships USA</span>}
      {item.localSdtj && <span className="ff-badge ff-badge-local">Local · SD/TJ</span>}
    </div>
  );
}
