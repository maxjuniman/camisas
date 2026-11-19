import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { productInclude, serializeProduct } from '../../common/serialize';
import { normalizeName, slugify } from '../../common/text';
import { PrismaService } from '../../prisma/prisma.service';
import { captionTeam, hasChinese } from '../scraping/caption-pt';
import { friendlyName } from '../scraping/catalog-name';
import { MediaService } from '../media/media.service';
import { AdminProductQueryDto, BulkEditDto, PatchFlagsDto, UpsertProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async list(query: AdminProductQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = 100;
    const where = this.productWhere(query);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map(serializeProduct), total, page, pageSize };
  }

  async get(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: productInclude });
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return serializeProduct(product);
  }

  async create(dto: UpsertProductDto) {
    const slug = await this.uniqueSlug(dto.name);
    const product = await this.prisma.product.create({
      data: {
        ...this.data(dto),
        slug,
        sizes: { create: (dto.sizeIds ?? []).map((sizeId) => ({ sizeId })) },
      },
      include: productInclude,
    });
    return serializeProduct(product);
  }

  async update(id: string, dto: UpsertProductDto) {
    await this.get(id);
    const slug = await this.uniqueSlug(dto.name, id);
    const product = await this.prisma.$transaction(async (tx) => {
      await tx.productSize.deleteMany({ where: { productId: id } });
      return tx.product.update({
        where: { id },
        data: {
          ...this.data(dto),
          slug,
          sizes: { create: (dto.sizeIds ?? []).map((sizeId) => ({ sizeId })) },
        },
        include: productInclude,
      });
    });
    return serializeProduct(product);
  }

  async bulk(dto: BulkEditDto) {
    if (dto.price == null && !dto.sportId && !dto.countryId && !dto.categoryId && !dto.teamId && !dto.translateNames) {
      throw new BadRequestException('Escolha o que deseja alterar.');
    }
    if (dto.scope === 'ids' && !dto.ids?.length) throw new BadRequestException('Selecione ao menos um produto.');
    const where: Prisma.ProductWhereInput = dto.scope === 'ids'
      ? { id: { in: dto.ids } }
      : this.productWhere({
          q: dto.q,
          teamId: dto.filterTeamId,
          sportId: dto.filterSportId,
          countryId: dto.filterCountryId,
          categoryId: dto.filterCategoryId,
          status: dto.status,
          national: dto.national,
        });
    const products = await this.prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        sportId: true,
        countryId: true,
        teamId: true,
        team: { select: { sportId: true, countryId: true } },
      },
    });
    const [teams, sports, countries, slugs] = await Promise.all([
      this.prisma.team.findMany({ select: { id: true, name: true, slug: true, isNational: true, sportId: true, countryId: true } }),
      this.prisma.sport.findMany({ where: { isActive: true }, select: { id: true, slug: true } }),
      this.prisma.country.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      this.prisma.product.findMany({ select: { slug: true } }),
    ]);
    const usedSlugs = new Set(slugs.map((item) => item.slug));
    let updated = 0;
    for (const product of products) {
      const data: Prisma.ProductUpdateInput = {};
      if (dto.price != null) data.price = dto.price;
      if (dto.sportId) data.sport = { connect: { id: dto.sportId } };
      if (dto.countryId) data.country = { connect: { id: dto.countryId } };
      if (dto.categoryId) data.category = { connect: { id: dto.categoryId } };
      if (dto.teamId) data.team = { connect: { id: dto.teamId } };
      if (dto.translateNames && hasChinese(product.name)) {
        const translated = friendlyName(product.name).trim();
        if (translated.length >= 2 && translated !== product.name) {
          const slug = this.takeSlug(translated, product.slug, usedSlugs);
          data.name = translated;
          data.normalizedName = normalizeName(translated);
          data.slug = slug;
        }
        if (!dto.teamId) {
          const parsed = captionTeam(product.name);
          if (parsed) {
            const sportId = dto.sportId || sports.find((sport) => sport.slug === parsed.sport)?.id || null;
            const countryId = dto.countryId || countries.find((country) => country.name.toLowerCase() === parsed.country.toLowerCase())?.id || null;
            const teamId = await this.ensureCatalogTeam(parsed.name, sportId, countryId, teams);
            data.team = { connect: { id: teamId } };
            if (!dto.sportId && sportId) data.sport = { connect: { id: sportId } };
            if (!dto.countryId && countryId) data.country = { connect: { id: countryId } };
          }
        }
      }
      if (!dto.teamId && !data.team && product.teamId && (dto.sportId || dto.countryId)) {
        const wrongSport = Boolean(dto.sportId && product.team?.sportId && product.team.sportId !== dto.sportId);
        const wrongCountry = Boolean(dto.countryId && product.team?.countryId && product.team.countryId !== dto.countryId);
        if (wrongSport || wrongCountry) data.team = { disconnect: true };
      }
      if (!Object.keys(data).length) continue;
      await this.prisma.product.update({ where: { id: product.id }, data });
      updated += 1;
    }
    return { updated };
  }

  async patchFlags(id: string, dto: PatchFlagsDto) {
    await this.get(id);
    await this.prisma.product.update({ where: { id }, data: dto });
    return this.get(id);
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }

  async addImages(id: string, files: Express.Multer.File[]) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado.');
    if (!files?.length) throw new ConflictException('Envie ao menos uma imagem.');

    let order = product.images.length;
    const hasPrimary = product.images.some((image) => image.isPrimary);
    for (const [index, file] of files.entries()) {
      const stored = await this.media.save(file.buffer);
      await this.prisma.productImage.create({
        data: {
          productId: id,
          ...stored,
          alt: product.name,
          sortOrder: order,
          isPrimary: !hasPrimary && index === 0,
        },
      });
      order += 1;
    }
    return this.get(id);
  }

  async removeImage(id: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId: id } });
    if (!image) throw new NotFoundException('Imagem não encontrada.');
    await this.prisma.productImage.delete({ where: { id: imageId } });
    if (image.isPrimary) {
      const next = await this.prisma.productImage.findFirst({
        where: { productId: id },
        orderBy: { sortOrder: 'asc' },
      });
      if (next) await this.prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    return this.get(id);
  }

  async reorderImages(id: string, imageIds: string[]) {
    const images = await this.prisma.productImage.findMany({ where: { productId: id }, select: { id: true } });
    if (!images.length) throw new NotFoundException('Este produto não tem fotos.');
    const known = new Set(images.map((image) => image.id));
    const unique = new Set(imageIds);
    if (unique.size !== imageIds.length || imageIds.length !== images.length || imageIds.some((imageId) => !known.has(imageId))) {
      throw new BadRequestException('A ordem precisa incluir cada foto do produto uma vez.');
    }
    await this.prisma.$transaction(
      imageIds.map((imageId, index) =>
        this.prisma.productImage.update({
          where: { id: imageId },
          data: { sortOrder: index, isPrimary: index === 0 },
        }),
      ),
    );
    return this.get(id);
  }

  async makePrimary(id: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId: id } });
    if (!image) throw new NotFoundException('Imagem não encontrada.');
    await this.prisma.$transaction([
      this.prisma.productImage.updateMany({ where: { productId: id }, data: { isPrimary: false } }),
      this.prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
    ]);
    return this.get(id);
  }

  private productWhere(query: {
    q?: string;
    teamId?: string;
    sportId?: string;
    countryId?: string;
    categoryId?: string;
    status?: ProductStatus;
    isActive?: boolean;
    national?: boolean;
  }): Prisma.ProductWhereInput {
    const and: Prisma.ProductWhereInput[] = [];
    if (query.sportId) and.push({ OR: [{ sportId: query.sportId }, { team: { sportId: query.sportId } }] });
    if (query.countryId) and.push({ OR: [{ countryId: query.countryId }, { team: { countryId: query.countryId } }] });
    const text = query.q?.trim();
    if (text) {
      and.push({
        OR: [
          { name: { contains: text, mode: 'insensitive' } },
          { externalId: { contains: text, mode: 'insensitive' } },
          { team: { name: { contains: text, mode: 'insensitive' } } },
        ],
      });
    }
    return {
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.national === true ? { team: { isNational: true } } : {}),
      ...(query.national === false ? { team: { isNational: false } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.isActive != null ? { isActive: query.isActive } : {}),
      ...(and.length ? { AND: and } : {}),
    };
  }

  private data(dto: UpsertProductDto) {
    return {
      name: dto.name.trim(),
      description: dto.description?.trim() ?? '',
      price: dto.price,
      normalizedName: normalizeName(dto.name),
      teamId: dto.teamId ?? null,
      sportId: dto.sportId ?? null,
      countryId: dto.countryId ?? null,
      genderId: dto.genderId ?? null,
      categoryId: dto.categoryId ?? null,
      seasonId: dto.seasonId ?? null,
      status: dto.status ?? ProductStatus.APPROVED,
      isActive: dto.isActive ?? true,
      availableForOrder: dto.availableForOrder ?? true,
      isFeatured: dto.isFeatured ?? false,
      isLaunch: dto.isLaunch ?? false,
      availabilityNote: dto.availabilityNote?.trim() ?? '',
      orderNote: dto.orderNote?.trim() ?? '',
    };
  }

  private takeSlug(name: string, current: string, used: Set<string>) {
    const base = slugify(name);
    let slug = base;
    let index = 2;
    while (used.has(slug) && slug !== current) {
      slug = `${base}-${index}`;
      index += 1;
    }
    if (slug !== current) {
      used.delete(current);
      used.add(slug);
    }
    return slug;
  }

  private async ensureCatalogTeam(
    name: string,
    sportId: string | null,
    countryId: string | null,
    teams: { id: string; name: string; slug: string; isNational: boolean; sportId: string | null; countryId: string | null }[],
  ) {
    const key = normalizeName(name);
    const found = teams.find((team) => !team.isNational && normalizeName(team.name) === key);
    if (found) {
      const data: { sportId?: string; countryId?: string } = {};
      if (sportId && found.sportId !== sportId) data.sportId = sportId;
      if (countryId && found.countryId !== countryId) data.countryId = countryId;
      if (Object.keys(data).length) {
        await this.prisma.team.update({ where: { id: found.id }, data });
        found.sportId = sportId || found.sportId;
        found.countryId = countryId || found.countryId;
      }
      return found.id;
    }
    let slug = slugify(name);
    let index = 2;
    while (teams.some((team) => team.slug === slug)) {
      slug = `${slugify(name)}-${index}`;
      index += 1;
    }
    const created = await this.prisma.team.create({
      data: { name, slug, sportId, countryId, isNational: false, sortOrder: teams.length },
      select: { id: true, name: true, slug: true, isNational: true, sportId: true, countryId: true },
    });
    teams.push(created);
    return created.id;
  }

  private async uniqueSlug(name: string, ignoreId?: string) {
    const base = slugify(name);
    let slug = base;
    let index = 2;
    while (true) {
      const found = await this.prisma.product.findUnique({ where: { slug } });
      if (!found || found.id === ignoreId) return slug;
      slug = `${base}-${index}`;
      index += 1;
    }
  }
}
