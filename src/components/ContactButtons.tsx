import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../lib/api";
import type { Item, SiteConfig } from "../lib/types";
import { formatDual } from "../lib/format";
import { useLang } from "../i18n/LanguageContext";
import { useRate } from "../lib/currency";

function waLink(phone: string, text: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
function smsLink(phone: string, text: string): string {
  return `sms:${phone}?&body=${encodeURIComponent(text)}`;
}

export default function ContactButtons({ item }: { item: Item }) {
  const { t } = useLang();
  const rate = useRate();
  const [cfg, setCfg] = useState<SiteConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [message, setMessage] = useState(t("contact.defaultMessage", { title: item.title }));
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api.config().then(setCfg).catch(() => setCfg(null)); }, []);

  const pitch = t("contact.pitch", {
    title: item.title,
    price: formatDual(item.priceCents, rate),
    url: `${location.origin}/item/${item.slug}`,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.contact(item.id, { name, message, replyTo });
      setSent(true);
    } catch (e2) {
      setErr(t("contact.sendError"));
    }
  }

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
      {cfg && (
        <>
          <a className="ff-btn ff-btn-green" href={waLink(cfg.whatsapp, pitch)} target="_blank" rel="noreferrer">
            {t("contact.whatsapp")}
          </a>
          <a className="ff-btn ff-btn-outline" href={smsLink(cfg.sms, pitch)}>{t("contact.sms")}</a>
          {cfg.instagramUrl && (
            <a className="ff-btn ff-btn-outline" href={cfg.instagramUrl} target="_blank" rel="noreferrer">
              {t("contact.instagramDm")}
            </a>
          )}
        </>
      )}
      <button className="ff-btn ff-btn-outline" onClick={() => setShowForm((s) => !s)}>
        {t("contact.messageSeller")}
      </button>

      {showForm && !sent && (
        <form onSubmit={submit} style={{ border: "1px solid var(--ff-line)", borderRadius: 10, padding: 12 }}>
          <div className="ff-field">
            <label>{t("contact.yourName")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="ff-field">
            <label>{t("contact.yourEmail")}</label>
            <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} type="email" />
          </div>
          <div className="ff-field">
            <label>{t("contact.messageLabel")}</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>
          {err && <p style={{ color: "#a50e0e" }}>{err}</p>}
          <button className="ff-btn ff-btn-green" type="submit">{t("contact.send")}</button>
        </form>
      )}
      {sent && <p style={{ color: "var(--ff-green-dark)" }}>{t("contact.sent")}</p>}
    </div>
  );
}
