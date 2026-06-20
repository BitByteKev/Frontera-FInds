export default function About() {
  return (
    <main className="ff-wrap" style={{ maxWidth: 720 }}>
      <span style={{ font: "600 12px 'Hanken Grotesk'", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ff-agave-600)" }}>
        El swapmeet sin fronteras
      </span>
      <h1 style={{ margin: "12px 0 0" }}>Two cities. One marketplace.</h1>
      <p style={{ lineHeight: 1.7, fontSize: 18 }}>
        Frontera Finds is my personal online swapmeet for the San Diego–Tijuana
        border — a Sunday garage sale that stretches across the line. Everything
        here is mine, one-of-one, priced to move.
      </p>

      <h3>Shipping across the USA 🇺🇸</h3>
      <p style={{ lineHeight: 1.7 }}>
        Most items can ship anywhere in the United States. Message me with your
        ZIP and I’ll confirm shipping before you pay.
      </p>

      <h3>Local pickup &amp; delivery — San Diego ⟷ Tijuana 🌵</h3>
      <p style={{ lineHeight: 1.7 }}>
        On either side of the line? Skip shipping — arrange free local pickup, or
        local delivery on bigger items. Just tap WhatsApp or text on any listing.
      </p>

      <h3>How to buy</h3>
      <p style={{ lineHeight: 1.7 }}>
        There’s no checkout here. Find something you like, hit <strong>WhatsApp</strong>,{" "}
        <strong>Text</strong>, <strong>Message the seller</strong>, or <strong>Instagram</strong>,
        and we’ll sort out payment (cash, Venmo, Zelle) and handoff directly.
      </p>
    </main>
  );
}
