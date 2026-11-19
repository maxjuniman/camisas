import { Prisma } from '@prisma/client';

export const productInclude = {
  team: true,
  sport: true,
  country: true,
  gender: true,
  category: true,
  season: true,
  images: { orderBy: { sortOrder: 'asc' as const } },
  sizes: { include: { size: true }, orderBy: { size: { sortOrder: 'asc' as const } } },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export function serializeProduct(product: ProductWithRelations) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: Number(product.price),
    team: product.team,
    sport: product.sport,
    country: product.country,
    gender: product.gender,
    category: product.category,
    season: product.season,
    sizes: product.sizes.map((item) => item.size),
    images: product.images.map((image) => ({
      id: image.id,
      url: image.url,
      thumbUrl: image.thumbUrl,
      alt: image.alt,
      isPrimary: image.isPrimary,
      sortOrder: image.sortOrder,
      sourceUrl: image.sourceUrl,
    })),
    status: product.status,
    isActive: product.isActive,
    availableForOrder: product.availableForOrder,
    isFeatured: product.isFeatured,
    isLaunch: product.isLaunch,
    availabilityNote: product.availabilityNote,
    orderNote: product.orderNote,
    sourceUrl: product.sourceUrl,
    externalId: product.externalId,
    discontinued: product.discontinued,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export const publicProductWhere: Prisma.ProductWhereInput = {
  status: 'APPROVED',
  isActive: true,
  availableForOrder: true,
};
