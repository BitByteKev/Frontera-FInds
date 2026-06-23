export interface ItemRow {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  price_cents: number;
  category: string;
  ships_usa: number;
  local_sdtj: number;
  status: string;
  created_at: number;
  updated_at: number;
  sold_at: number | null;
  title_en: string | null;
  title_es: string | null;
  description_en: string | null;
  description_es: string | null;
}

export interface Item {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  category: string;
  shipsUsa: boolean;
  localSdtj: boolean;
  status: "published" | "sold" | "hidden";
  createdAt: number;
  updatedAt: number;
  soldAt: number | null;
  photoKeys: string[];
  titleEn: string | null;
  titleEs: string | null;
  descriptionEn: string | null;
  descriptionEs: string | null;
}

export function rowToItem(row: ItemRow, photoKeys: string[]): Item {
  return {
    id: row.id,
    slug: row.slug ?? row.id, // fall back to id for rows created before slugs existed
    title: row.title,
    description: row.description,
    priceCents: row.price_cents,
    category: row.category,
    shipsUsa: row.ships_usa === 1,
    localSdtj: row.local_sdtj === 1,
    status: row.status as Item["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    soldAt: row.sold_at ?? null,
    photoKeys,
    titleEn: row.title_en ?? null,
    titleEs: row.title_es ?? null,
    descriptionEn: row.description_en ?? null,
    descriptionEs: row.description_es ?? null,
  };
}
