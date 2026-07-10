import type { CSSProperties } from "react";
import { useLang } from "../i18n/LanguageContext";
import reviewsData from "../data/reviews.json";

const FB_PROFILE = "https://www.facebook.com/marketplace/profile/61558944447221/";

const TAG_KEYS = {
  communication: "reviews.tag.communication",
  pricing: "reviews.tag.pricing",
  punctuality: "reviews.tag.punctuality",
  itemDescription: "reviews.tag.itemDescription",
} as const;

const chip: CSSProperties = {
  border: "1px solid var(--ff-line)",
  borderRadius: 999,
  padding: "3px 10px",
  fontSize: 13,
};

export default function Reviews() {
  const { t, lang } = useLang();
  const { summary, reviews } = reviewsData;
  const fmt = new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", { month: "long", year: "numeric" });
  return (
    <main className="ff-wrap" style={{ maxWidth: 720 }}>
      <span style={{ font: "600 12px 'Hanken Grotesk'", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ff-agave-600)" }}>
        {t("reviews.kicker")}
      </span>
      <h1 style={{ margin: "12px 0 4px" }}>{t("reviews.title")}</h1>
      <div style={{ fontSize: 22, color: "var(--ff-agave-600)", letterSpacing: 2 }} aria-hidden="true">★★★★★</div>
      <p style={{ fontWeight: 700, margin: "6px 0 2px" }}>
        {t("reviews.summary", { rating: String(summary.rating), count: String(summary.count) })}
      </p>
      <p style={{ margin: "0 0 16px" }}>{t("reviews.highlyRated")}</p>

      <h3 style={{ margin: "0 0 8px" }}>{t("reviews.strengthsHeading")}</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {(Object.entries(summary.strengths) as [keyof typeof TAG_KEYS, number][]).map(([k, n]) => (
          <span key={k} style={chip}>{t(TAG_KEYS[k])} · {n}</span>
        ))}
      </div>
      <p style={{ fontSize: 13, margin: "0 0 18px" }}>{t("reviews.langNote")}</p>

      <div style={{ display: "grid", gap: 12 }}>
        {reviews.map((r, i) => (
          <article key={i} style={{ border: "1px solid var(--ff-line)", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <strong>{r.name}</strong>
              <span style={{ fontSize: 13 }}>{fmt.format(new Date(r.date + "T12:00:00"))}</span>
            </div>
            {r.tags.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 0" }}>
                {r.tags.map((tag) => (
                  <span key={tag} style={chip}>{t(TAG_KEYS[tag as keyof typeof TAG_KEYS])}</span>
                ))}
              </div>
            )}
            <p style={{ margin: "10px 0 0", lineHeight: 1.6 }}>{r.text}</p>
          </article>
        ))}
      </div>

      <p style={{ marginTop: 22 }}>
        <a href={FB_PROFILE} target="_blank" rel="noreferrer">{t("reviews.seeAllFb")}</a>
      </p>
    </main>
  );
}
