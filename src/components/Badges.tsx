import type { Item } from "../lib/types";
import { useLang } from "../i18n/LanguageContext";

export default function Badges({ item }: { item: Item }) {
  const { t } = useLang();
  return (
    <div className="ff-badges">
      {item.shipsUsa && <span className="ff-badge ff-badge-ship">{t("badge.shipsUsa")}</span>}
      {item.localSdtj && <span className="ff-badge ff-badge-local">{t("badge.localSdTj")}</span>}
    </div>
  );
}
