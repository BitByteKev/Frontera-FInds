import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminApi, clearToken, getToken } from "../../lib/api";
import { monthlySales, type SalesSummary } from "../../lib/stats";
import { money, pesosFromCents } from "../../lib/format";
import { useRate } from "../../lib/currency";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rate = useRate();

  useEffect(() => {
    if (!getToken()) { navigate("/admin"); return; }
    adminApi.listAll()
      .then((r) => setSummary(monthlySales(r.items, Date.now())))
      .catch((e) => {
        if (String(e).includes("unauthorized")) { clearToken(); navigate("/admin"); }
        else setError(String(e));
      });
  }, []);

  const maxRevenue = summary ? Math.max(1, ...summary.months.map((m) => m.revenueCents)) : 1;

  return (
    <main className="ff-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Sales dashboard</h1>
        <Link className="ff-btn ff-btn-outline" to="/admin/manage">Your items</Link>
      </div>
      {error && <p style={{ color: "#a50e0e" }}>{error}</p>}

      {summary && summary.soldCount === 0 && <p>No sales yet. Mark an item sold to see it here.</p>}

      {summary && summary.soldCount > 0 && (
        <>
          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px", border: "1px solid var(--ff-line)", borderRadius: 10,
              padding: 16, background: "var(--ff-card)" }}>
              <div style={{ color: "var(--ff-muted)", fontSize: 13 }}>Items sold</div>
              <div style={{ fontWeight: 800, fontSize: 28 }}>{summary.soldCount}</div>
            </div>
            <div style={{ flex: "1 1 160px", border: "1px solid var(--ff-line)", borderRadius: 10,
              padding: 16, background: "var(--ff-card)" }}>
              <div style={{ color: "var(--ff-muted)", fontSize: 13 }}>Total revenue</div>
              <div style={{ fontWeight: 800, fontSize: 28 }}>{money(summary.totalRevenueCents)}</div>
              <div style={{ color: "var(--ff-muted)", fontSize: 13 }}>
                ~${pesosFromCents(summary.totalRevenueCents, rate).toLocaleString("en-US")} MXN
              </div>
            </div>
          </div>

          <h2 style={{ marginTop: 20 }}>Revenue by month</h2>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 220,
            border: "1px solid var(--ff-line)", borderRadius: 10, padding: 12,
            background: "var(--ff-card)", overflowX: "auto" }}>
            {summary.months.map((m) => {
              const h = Math.round((m.revenueCents / maxRevenue) * 160);
              return (
                <div key={m.month} style={{ display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "flex-end", minWidth: 44, flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--ff-muted)" }}>
                    {m.count > 0 ? m.count : ""}
                  </div>
                  <div
                    title={`${m.label}: ${money(m.revenueCents)} (${m.count} sold)`}
                    style={{ width: "100%", height: Math.max(h, m.revenueCents > 0 ? 4 : 0),
                      background: "var(--ff-green, #5BD074)", borderRadius: "4px 4px 0 0" }}
                  />
                  <div style={{ fontSize: 11, color: "var(--ff-muted)", marginTop: 4,
                    whiteSpace: "nowrap" }}>{m.label.split(" ")[0]}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
