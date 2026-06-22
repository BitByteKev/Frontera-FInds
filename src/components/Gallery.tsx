import { useState } from "react";
import { imgUrl } from "../lib/format";
import { useLang } from "../i18n/LanguageContext";

// Item photos: a single fixed-height frame so images never take over the page.
// One photo → just the framed image. Many → a slideshow with arrows + thumbnails.
export default function Gallery({ photoKeys, title }: { photoKeys: string[]; title: string }) {
  const [i, setI] = useState(0);
  const n = photoKeys.length;
  const { t } = useLang();

  if (n === 0) {
    return <div className="ff-gallery-frame ff-gallery-empty" aria-hidden="true" />;
  }

  const current = Math.min(i, n - 1);
  const go = (d: number) => setI((p) => (p + d + n) % n);

  return (
    <div className="ff-gallery">
      <div className="ff-gallery-frame">
        <img src={imgUrl(photoKeys[current])} alt={n > 1 ? t("gallery.photoAlt", { title, n: current + 1, total: n }) : title} />
        {n > 1 && (
          <>
            <button className="ff-gallery-nav ff-gallery-prev" onClick={() => go(-1)} aria-label={t("gallery.prev")}>‹</button>
            <button className="ff-gallery-nav ff-gallery-next" onClick={() => go(1)} aria-label={t("gallery.next")}>›</button>
            <span className="ff-gallery-count">{current + 1} / {n}</span>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="ff-gallery-thumbs">
          {photoKeys.map((k, idx) => (
            <button
              key={k}
              className={idx === current ? "ff-thumb ff-thumb-active" : "ff-thumb"}
              onClick={() => setI(idx)}
              aria-label={t("gallery.showPhoto", { n: idx + 1 })}
              aria-current={idx === current}
            >
              <img src={imgUrl(k)} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
