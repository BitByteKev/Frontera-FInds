import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminApi, getToken } from "../../lib/api";
import type { Item } from "../../lib/types";
import { imgUrl } from "../../lib/format";

export default function AdminEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);

  const [photoKeys, setPhotoKeys] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [category, setCategory] = useState("misc");
  const [shipsUsa, setShipsUsa] = useState(true);
  const [localSdtj, setLocalSdtj] = useState(true);
  const [status, setStatus] = useState<Item["status"]>("published");

  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) { navigate("/admin"); return; }
    if (editing && id) {
      fetch(`/api/items/${id}`).then((r) => r.json()).then(({ item }: { item: Item }) => {
        setPhotoKeys(item.photoKeys); setTitle(item.title); setDescription(item.description);
        setPriceDollars((item.priceCents / 100).toString()); setCategory(item.category);
        setShipsUsa(item.shipsUsa); setLocalSdtj(item.localSdtj); setStatus(item.status);
      }).catch(() => setError("Couldn't load item."));
    }
  }, [id]);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true); setError(null);
    try {
      const { keys } = await adminApi.upload(files);
      setPhotoKeys((prev) => [...prev, ...keys]);
    } catch { setError("Upload failed."); }
    finally { setUploading(false); }
  }

  async function runAI() {
    if (photoKeys.length === 0) { setError("Add a photo first."); return; }
    setGenerating(true); setError(null);
    try {
      const g = await adminApi.generate(photoKeys);
      setTitle(g.title); setDescription(g.description); setPriceDollars((g.priceCents / 100).toString());
    } catch { setError("AI couldn't generate — fill it in manually."); }
    finally { setGenerating(false); }
  }

  async function save() {
    setError(null);
    const body: Partial<Item> = {
      title, description,
      priceCents: Math.round(parseFloat(priceDollars || "0") * 100),
      category, shipsUsa, localSdtj, status, photoKeys,
    };
    try {
      if (editing && id) await adminApi.update(id, body);
      else await adminApi.create(body);
      navigate("/admin/manage");
    } catch (e) { setError(String(e)); }
  }

  return (
    <main className="ff-wrap" style={{ maxWidth: 560 }}>
      <h1>{editing ? "Edit item" : "New item"}</h1>

      <div className="ff-field">
        <label>Photos</label>
        <input type="file" accept="image/*" multiple onChange={onFiles} />
        {uploading && <p>Uploading…</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {photoKeys.map((k) => (
            <img key={k} src={imgUrl(k)} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }} />
          ))}
        </div>
      </div>

      <button className="ff-btn ff-btn-green" onClick={runAI} disabled={generating || photoKeys.length === 0}>
        {generating ? "✨ Generating…" : "✨ Generate with AI"}
      </button>

      {error && <p style={{ color: "#a50e0e" }}>{error}</p>}

      <div className="ff-field"><label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="ff-field"><label>Description</label>
        <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="ff-field"><label>Price (USD)</label>
        <input value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} inputMode="decimal" /></div>
      <div className="ff-field"><label>Category</label>
        <input value={category} onChange={(e) => setCategory(e.target.value)} /></div>

      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
        <input type="checkbox" checked={shipsUsa} onChange={(e) => setShipsUsa(e.target.checked)} /> Ships USA
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
        <input type="checkbox" checked={localSdtj} onChange={(e) => setLocalSdtj(e.target.checked)} /> Local pickup / delivery (SD/TJ)
      </label>

      <div className="ff-field"><label>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as Item["status"])}>
          <option value="published">Published</option>
          <option value="hidden">Hidden</option>
          <option value="sold">Sold</option>
        </select>
      </div>

      <button className="ff-btn ff-btn-green" onClick={save}>{editing ? "Save changes" : "Publish"}</button>
    </main>
  );
}
