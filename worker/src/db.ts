export interface ItemRow {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  category: string;
  ships_usa: number;
  local_sdtj: number;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  category: string;
  shipsUsa: boolean;
  localSdtj: boolean;
  status: "published" | "sold" | "hidden";
  createdAt: number;
  updatedAt: number;
  photoKeys: string[];
}

export function rowToItem(row: ItemRow, photoKeys: string[]): Item {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priceCents: row.price_cents,
    category: row.category,
    shipsUsa: row.ships_usa === 1,
    localSdtj: row.local_sdtj === 1,
    status: row.status as Item["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photoKeys,
  };
}
