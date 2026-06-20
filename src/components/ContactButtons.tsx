import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../lib/api";
import type { Item, SiteConfig } from "../lib/types";
import { money } from "../lib/format";

function waLink(phone: string, text: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
function smsLink(phone: string, text: string): string {
  return `sms:${phone}?&body=${encodeURIComponent(text)}`;
}

export default function ContactButtons({ item }: { item: Item }) {
  const [cfg, setCfg] = useState<SiteConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [message, setMessage] = useState(`Hi! Is "${item.title}" still available?`);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api.config().then(setCfg).catch(() => setCfg(null)); }, []);

  const pitch = `Hi! I'm interested in "${item.title}" (${money(item.priceCents)}) on Frontera Finds: ${location.origin}/item/${item.id}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.contact(item.id, { name, message, replyTo });
      setSent(true);
    } catch (e2) {
      setErr("Couldn't send — please try WhatsApp or text instead.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
      {cfg && (
        <>
          <a className="ff-btn ff-btn-green" href={waLink(cfg.whatsapp, pitch)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <a className="ff-btn ff-btn-outline" href={smsLink(cfg.sms, pitch)}>Text / SMS</a>
          {cfg.instagramUrl && (
            <a className="ff-btn ff-btn-outline" href={cfg.instagramUrl} target="_blank" rel="noreferrer">
              Instagram DM
            </a>
          )}
        </>
      )}
      <button className="ff-btn ff-btn-outline" onClick={() => setShowForm((s) => !s)}>
        Message the seller
      </button>

      {showForm && !sent && (
        <form onSubmit={submit} style={{ border: "1px solid var(--ff-line)", borderRadius: 10, padding: 12 }}>
          <div className="ff-field">
            <label>Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="ff-field">
            <label>Your email (so the seller can reply)</label>
            <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} type="email" />
          </div>
          <div className="ff-field">
            <label>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>
          {err && <p style={{ color: "#a50e0e" }}>{err}</p>}
          <button className="ff-btn ff-btn-green" type="submit">Send</button>
        </form>
      )}
      {sent && <p style={{ color: "var(--ff-green-dark)" }}>Sent! The seller will get back to you.</p>}
    </div>
  );
}
