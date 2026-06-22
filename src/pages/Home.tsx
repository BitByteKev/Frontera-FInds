import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Item } from "../lib/types";
import ItemCard from "../components/ItemCard";
import { useLang } from "../i18n/LanguageContext";

export default function Home() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ships = params.get("ships") === "1";
  const local = params.get("local") === "1";
  const hideSold = params.get("hideSold") === "1";
  const q = params.get("q") ?? "";
  const sort = params.get("sort") ?? "newest";
  const minPrice = params.get("minPrice") ?? "";
  const maxPrice = params.get("maxPrice") ?? "";
  const { t } = useLang();

  useEffect(() => {
    setLoading(true);
    // Build the API query from the URL: by default include sold (shown with a
    // badge) unless the user opts to hide them, and convert the dollar price
    // inputs to cents for the API.
    const api1 = new URLSearchParams();
    for (const k of ["q", "category", "ships", "local", "sort"]) {
      const v = params.get(k);
      if (v) api1.set(k, v);
    }
    if (params.get("hideSold") !== "1") api1.set("sold", "1");
    const min = Number(params.get("minPrice"));
    if (params.get("minPrice") && Number.isFinite(min)) api1.set("minPrice", String(Math.round(min * 100)));
    const max = Number(params.get("maxPrice"));
    if (params.get("maxPrice") && Number.isFinite(max)) api1.set("maxPrice", String(Math.round(max * 100)));

    api.list(api1)
      .then((r) => { setItems(r.items); setError(null); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [params]);

  // Update a single URL param (empty value removes it). Shareable + reloadable.
  // replace:true so per-keystroke edits don't flood browser history.
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  function toggle(key: "ships" | "local" | "hideSold") {
    setParam(key, params.get(key) === "1" ? "" : "1");
  }

  return (
    <>
    <div className="ff-hero">
      <div className="ff-hero-tag">
        <b>{t("home.heroTitle")}</b>
        <i>{t("home.heroSub")}</i>
      </div>
      <span className="ff-pill">
        San Diego <span className="ff-arrow">⟷</span> Tijuana
        <span className="ff-dot" /> {t("home.shippingUsa")}
      </span>
    </div>
    <main className="ff-wrap">
      <div className="ff-filters">
        <input
          className="ff-input"
          type="search"
          placeholder={t("home.searchPlaceholder")}
          defaultValue={q}
          onChange={(e) => setParam("q", e.target.value.trim())}
        />
        <select className="ff-input" value={sort} onChange={(e) => setParam("sort", e.target.value === "newest" ? "" : e.target.value)}>
          <option value="newest">{t("home.sortNewest")}</option>
          <option value="price_asc">{t("home.sortPriceAsc")}</option>
          <option value="price_desc">{t("home.sortPriceDesc")}</option>
        </select>
        <input className="ff-input ff-input-price" type="number" min="0" placeholder={t("home.minPrice")} defaultValue={minPrice}
          onChange={(e) => setParam("minPrice", e.target.value)} />
        <input className="ff-input ff-input-price" type="number" min="0" placeholder={t("home.maxPrice")} defaultValue={maxPrice}
          onChange={(e) => setParam("maxPrice", e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button className={ships ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("ships")}>
          {t("home.filterShips")}
        </button>
        <button className={local ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("local")}>
          {t("home.filterLocal")}
        </button>
        <button className={hideSold ? "ff-btn ff-btn-green" : "ff-btn ff-btn-outline"} onClick={() => toggle("hideSold")}>
          {t("home.filterHideSold")}
        </button>
      </div>

      {loading && <p>{t("common.loading")}</p>}
      {error && <p style={{ color: "#a50e0e" }}>{t("home.loadErrorPrefix")}{error}</p>}
      {!loading && !error && items.length === 0 && <p>{t("home.noResults")}</p>}

      <div className="ff-grid">
        {items.map((it) => <ItemCard key={it.id} item={it} />)}
      </div>
    </main>
    </>
  );
}
