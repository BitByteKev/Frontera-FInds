import { useLang } from "../i18n/LanguageContext";

export default function About() {
  const { t } = useLang();
  return (
    <main className="ff-wrap" style={{ maxWidth: 720 }}>
      <span style={{ font: "600 12px 'Hanken Grotesk'", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ff-agave-600)" }}>
        {t("about.kicker")}
      </span>
      <h1 style={{ margin: "12px 0 0" }}>{t("about.title")}</h1>
      <p style={{ lineHeight: 1.7, fontSize: 18 }}>{t("about.intro")}</p>

      <h3>{t("about.shippingHeading")}</h3>
      <p style={{ lineHeight: 1.7 }}>{t("about.shippingBody")}</p>

      <h3>{t("about.localHeading")}</h3>
      <p style={{ lineHeight: 1.7 }}>{t("about.localBody")}</p>

      <h3>{t("about.howToBuyHeading")}</h3>
      <p style={{ lineHeight: 1.7 }}>
        {t("about.howToBuyLead")}{" "}
        <strong>{t("contact.whatsapp")}</strong>, <strong>{t("contact.sms")}</strong>,{" "}
        <strong>{t("contact.messageSeller")}</strong>, {t("about.orWord")}{" "}
        <strong>Instagram</strong>{t("about.howToBuyTail")}
      </p>
    </main>
  );
}
