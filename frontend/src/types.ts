export type RefItem = {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
  sortOrder?: number;
  sportId?: string | null;
  countryId?: string | null;
  sport?: { id: string; name: string; slug: string } | null;
  country?: { id: string; name: string; slug: string } | null;
};

export type ProductImage = {
  id: string;
  url: string;
  thumbUrl: string | null;
  alt: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  team: RefItem | null;
  sport: RefItem | null;
  country: RefItem | null;
  gender: RefItem | null;
  category: RefItem | null;
  season: RefItem | null;
  sizes: RefItem[];
  images: ProductImage[];
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'IGNORED';
  isActive: boolean;
  availableForOrder: boolean;
  isFeatured: boolean;
  isLaunch: boolean;
  availabilityNote: string;
  orderNote: string;
  sourceUrl: string | null;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function coverOf(product: Product) {
  const primary = product.images.find((image) => image.isPrimary) ?? product.images[0];
  return primary ?? null;
}

export const statusLabel: Record<Product['status'], string> = {
  DRAFT: 'Rascunho',
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  IGNORED: 'Ignorado',
};
