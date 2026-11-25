import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { productInclude, publicProductWhere, serializeProduct } from '../../common/serialize';
import { PrismaService } from '../../prisma/prisma.service';

type CatalogQuery = {
  q?: string;
  teams?: string;
  sports?: string;
  countries?: string;
  genders?: string;
  categories?: string;
  sizes?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'name';
  ready?: boolean;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CatalogQuery) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = Math.min(query.pageSize && query.pageSize > 0 ? query.pageSize : 12, 48);
    const where = this.buildWhere(query);
    const orderBy = this.orderBy(query.sort);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map(serializeProduct), total, page, pageSize };
  }

  async bySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, ...publicProductWhere },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return serializeProduct(product);
  }

  async home() {
    const where = publicProductWhere;
    const [ready, featured, launches, recent, divisions] = await Promise.all([
      this.prisma.product.findMany({
        where: { ...where, readyToShip: true },
        include: productInclude,
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      this.prisma.product.findMany({
        where: { ...where, isFeatured: true },
        include: productInclude,
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      this.prisma.product.findMany({
        where: { ...where, isLaunch: true },
        include: productInclude,
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.divisions(),
    ]);

    return {
      ready: ready.map(serializeProduct),
      featured: featured.map(serializeProduct),
      launches: launches.map(serializeProduct),
      recent: recent.map(serializeProduct),
      divisions,
    };
  }

  private async divisions() {
    const sports = await this.prisma.sport.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        teams: {
          where: { isActive: true, country: { isActive: true } },
          orderBy: { name: 'asc' },
          include: { country: true },
        },
      },
    });
    return sports.map((sport) => {
      const countries = new Map<string, { id: string; name: string; slug: string; teams: { id: string; name: string; slug: string }[] }>();
      for (const team of sport.teams) {
        if (!team.country) continue;
        const current = countries.get(team.country.id) ?? {
          id: team.country.id,
          name: team.country.name,
          slug: team.country.slug,
          teams: [],
        };
        current.teams.push({ id: team.id, name: team.name, slug: team.slug });
        countries.set(team.country.id, current);
      }
      return {
        id: sport.id,
        name: sport.name,
        slug: sport.slug,
        countries: [...countries.values()],
      };
    });
  }

  async filters() {
    const products = await this.prisma.product.findMany({
      where: publicProductWhere,
      select: {
        price: true,
        genderId: true,
        categoryId: true,
        sizes: { select: { sizeId: true } },
      },
    });
    const ids = {
      gender: new Set(products.map((item) => item.genderId).filter(Boolean) as string[]),
      category: new Set(products.map((item) => item.categoryId).filter(Boolean) as string[]),
      size: new Set(products.flatMap((item) => item.sizes.map((size) => size.sizeId))),
    };
    const prices = products.map((item) => Number(item.price));
    const [teams, sports, countries, genders, categories, sizes] = await Promise.all([
      this.prisma.team.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.sport.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.country.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.gender.findMany({ where: { isActive: true, id: { in: [...ids.gender] } }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.category.findMany({ where: { isActive: true, id: { in: [...ids.category] } }, orderBy: { name: 'asc' } }),
      this.prisma.size.findMany({ where: { isActive: true, id: { in: [...ids.size] } }, orderBy: { sortOrder: 'asc' } }),
    ]);
    return {
      teams,
      sports,
      countries,
      genders,
      categories,
      sizes,
      price: {
        min: prices.length ? Math.min(...prices) : 0,
        max: prices.length ? Math.max(...prices) : 0,
      },
    };
  }

  private buildWhere(query: CatalogQuery): Prisma.ProductWhereInput {
    const and: Prisma.ProductWhereInput[] = [publicProductWhere];
    if (query.q?.trim()) {
      const q = query.q.trim();
      and.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { team: { name: { contains: q, mode: 'insensitive' } } },
          { country: { name: { contains: q, mode: 'insensitive' } } },
          { sport: { name: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    this.pushSlugs(and, 'team', query.teams);
    this.pushSlugs(and, 'sport', query.sports);
    this.pushSlugs(and, 'country', query.countries);
    this.pushSlugs(and, 'gender', query.genders);
    this.pushSlugs(and, 'category', query.categories);
    const sizes = split(query.sizes);
    if (sizes.length) and.push({ sizes: { some: { size: { slug: { in: sizes }, isActive: true } } } });
    if (query.ready) and.push({ readyToShip: true });
    if (query.minPrice != null || query.maxPrice != null) {
      and.push({
        price: {
          gte: query.minPrice ?? undefined,
          lte: query.maxPrice ?? undefined,
        },
      });
    }
    return { AND: and };
  }

  private pushSlugs(and: Prisma.ProductWhereInput[], field: 'team' | 'sport' | 'country' | 'gender' | 'category', raw?: string) {
    const slugs = split(raw);
    if (!slugs.length) return;
    and.push({ [field]: { slug: { in: slugs }, isActive: true } });
  }

  private orderBy(sort?: CatalogQuery['sort']): Prisma.ProductOrderByWithRelationInput {
    if (sort === 'price_asc') return { price: 'asc' };
    if (sort === 'price_desc') return { price: 'desc' };
    if (sort === 'name') return { name: 'asc' };
    return { createdAt: 'desc' };
  }
}

function split(value?: string) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
