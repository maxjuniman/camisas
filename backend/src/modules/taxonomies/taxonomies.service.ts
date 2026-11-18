import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify } from '../../common/text';
import { PatchTaxonomyDto, UpsertTaxonomyDto } from './dto/taxonomy.dto';

const kinds = ['teams', 'sports', 'countries', 'genders', 'categories', 'seasons', 'sizes'] as const;
export type TaxonomyKind = (typeof kinds)[number];

@Injectable()
export class TaxonomiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(kind: TaxonomyKind) {
    this.assertKind(kind);
    if (kind === 'teams') {
      return this.prisma.team.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { sport: true, country: true },
      });
    }
    return this.delegate(kind).findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async create(kind: TaxonomyKind, dto: UpsertTaxonomyDto) {
    this.assertKind(kind);
    const slug = await this.uniqueSlug(kind, dto.name);
    const data = {
      name: dto.name.trim(),
      slug,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    };
    if (kind === 'teams') {
      return this.prisma.team.create({
        data: { ...data, sportId: dto.sportId ?? null, countryId: dto.countryId ?? null },
        include: { sport: true, country: true },
      });
    }
    return this.delegate(kind).create({ data });
  }

  async update(kind: TaxonomyKind, id: string, dto: PatchTaxonomyDto) {
    this.assertKind(kind);
    const current = await this.delegate(kind).findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Registro não encontrado.');
    const name = dto.name?.trim() || current.name;
    const slug = name === current.name ? current.slug : await this.uniqueSlug(kind, name, id);
    const data = {
      name,
      slug,
      isActive: dto.isActive ?? current.isActive,
      sortOrder: dto.sortOrder ?? current.sortOrder,
    };
    if (kind === 'teams') {
      return this.prisma.team.update({
        where: { id },
        data: {
          ...data,
          ...(dto.sportId !== undefined ? { sportId: dto.sportId } : {}),
          ...(dto.countryId !== undefined ? { countryId: dto.countryId } : {}),
        },
        include: { sport: true, country: true },
      });
    }
    return this.delegate(kind).update({ where: { id }, data });
  }

  async remove(kind: TaxonomyKind, id: string) {
    this.assertKind(kind);
    const current = await this.delegate(kind).findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Registro não encontrado.');
    const linked = await this.linkedCount(kind, id);
    if (linked > 0) {
      throw new ConflictException('Este item está ligado a produtos. Desvincule os produtos antes de excluir.');
    }
    await this.delegate(kind).delete({ where: { id } });
    return { ok: true };
  }

  private assertKind(kind: string): asserts kind is TaxonomyKind {
    if (!kinds.includes(kind as TaxonomyKind)) {
      throw new BadRequestException('Tipo de cadastro inválido.');
    }
  }

  private delegate(kind: TaxonomyKind): {
    findMany: (args?: object) => Promise<Array<{ id: string; name: string; slug: string; isActive: boolean; sortOrder: number }>>;
    findUnique: (args: { where: { id?: string; slug?: string } }) => Promise<{ id: string; name: string; slug: string; isActive: boolean; sortOrder: number } | null>;
    create: (args: { data: { name: string; slug: string; isActive: boolean; sortOrder: number } }) => Promise<unknown>;
    update: (args: { where: { id: string }; data: { name: string; slug: string; isActive: boolean; sortOrder: number } }) => Promise<unknown>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  } {
    const map = {
      teams: this.prisma.team,
      sports: this.prisma.sport,
      countries: this.prisma.country,
      genders: this.prisma.gender,
      categories: this.prisma.category,
      seasons: this.prisma.season,
      sizes: this.prisma.size,
    };
    return map[kind] as never;
  }

  private async linkedCount(kind: TaxonomyKind, id: string) {
    if (kind === 'sizes') return this.prisma.productSize.count({ where: { sizeId: id } });
    if (kind === 'countries') {
      const [products, teams] = await Promise.all([
        this.prisma.product.count({ where: { countryId: id } }),
        this.prisma.team.count({ where: { countryId: id } }),
      ]);
      return products + teams;
    }
    if (kind === 'sports') {
      const [products, teams] = await Promise.all([
        this.prisma.product.count({ where: { sportId: id } }),
        this.prisma.team.count({ where: { sportId: id } }),
      ]);
      return products + teams;
    }
    const field = {
      teams: 'teamId',
      genders: 'genderId',
      categories: 'categoryId',
      seasons: 'seasonId',
    }[kind as 'teams' | 'genders' | 'categories' | 'seasons'];
    return this.prisma.product.count({ where: { [field]: id } });
  }

  private async uniqueSlug(kind: TaxonomyKind, name: string, ignoreId?: string) {
    const base = slugify(name);
    let slug = base;
    let index = 2;
    while (true) {
      const found = await this.delegate(kind).findUnique({ where: { slug } });
      if (!found || found.id === ignoreId) return slug;
      slug = `${base}-${index}`;
      index += 1;
    }
  }
}
