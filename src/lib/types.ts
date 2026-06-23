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
  photoKeys: string[];
  titleEn?: string | null;
  titleEs?: string | null;
  descriptionEn?: string | null;
  descriptionEs?: string | null;
}

export interface SiteConfig {
  whatsapp: string;
  sms: string;
  instagramUrl: string;
}
