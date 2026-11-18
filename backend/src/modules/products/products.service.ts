import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { productInclude, serializeProduct } from '../../common/serialize';
import { normalizeName, slugify } from '../../common/text';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { AdminProductQueryDto, PatchFlagsDto, UpsertProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async list(query: AdminProductQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = 100;
    const where: Prisma.ProductWhereInput = {
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.sportId ? { sportId: query.sportId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.isActive != null ? { isActive: query.isActive } : {}),
      ...(query.q?.trim()
        ? {
            OR: [
              { name: { contains: query.q.trim(), mode: 'insensitive' } },
              { externalId: { contains: query.q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
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
