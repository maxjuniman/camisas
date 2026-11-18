import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MatchStatus, Prisma, ProductStatus } from '@prisma/client';
import { hammingHex } from '../../common/phash';
import { productInclude, serializeProduct } from '../../common/serialize';
import { normalizeName, similarity, slugify } from '../../common/text';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { ImportUrlsDto, ReviewDto } from './dto/scraping.dto';
import {
  AlbumRef,
  SupplierBlockedError,
  albumIdFromUrl,
  discoverAlbums,
  downloadImage,
  readAlbum,
} from './yupoo.client';

const NAME_THRESHOLD = 0.88;
const IMAGE_THRESHOLD = 10;

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async listJobs() {
    return this.prisma.scrapingJob.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
  }

  async getJob(id: string) {
    const job = await this.prisma.scrapingJob.findUnique({
      where: { id },
      include: { items: { orderBy: { createdAt: 'asc' }, include: { duplicates: true } } },
    });
    if (!job) throw new NotFoundException('Varredura não encontrada.');
    return job;
  }

  async listItems(reviewStatus?: string) {
    return this.prisma.scrapedProduct.findMany({
      where: reviewStatus ? { reviewStatus: reviewStatus as 'PENDING' | 'APPROVED' | 'IGNORED' } : undefined,
      include: { images: { orderBy: { sortOrder: 'asc' } }, duplicates: { include: { product: true } }, changes: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getItem(id: string) {
    const item = await this.prisma.scrapedProduct.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        changes: true,
        duplicates: { include: { product: { include: productInclude } } },
        linkedProduct: { include: productInclude },
      },
    });
    if (!item) throw new NotFoundException('Item não encontrado.');
    return {
      ...item,
      linkedProduct: item.linkedProduct ? serializeProduct(item.linkedProduct) : null,
      duplicates: item.duplicates.map((candidate) => ({
        ...candidate,
        product: serializeProduct(candidate.product),
      })),
    };
  }

  async start(forced: boolean, userId: string) {
    const job = await this.openJob(forced, process.env.YUPOO_CATEGORY_URL || 'https://minkang.x.yupoo.com/categories/680738', userId);
    setImmediate(() => {
      this.runDiscovered(job.id, forced).catch((error) => this.fail(job.id, error));
    });
    return job;
  }

  async importUrls(dto: ImportUrlsDto, userId: string) {
    const albums = dto.urls.map((url) => {
      const parsed = albumIdFromUrl(url);
      if (!parsed) throw new BadRequestException('Informe apenas links de álbuns do Yupoo.');
      return parsed;
    });
    const job = await this.openJob(true, 'importacao-manual', userId);
    setImmediate(() => {
      this.runAlbums(job.id, albums, true).catch((error) => this.fail(job.id, error));
    });
    return job;
  }

  async review(id: string, dto: ReviewDto) {
    const item = await this.prisma.scrapedProduct.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: 'asc' } }, linkedProduct: true },
    });
    if (!item) throw new NotFoundException('Item não encontrado.');
    if (dto.action === 'ignore') {
      return this.prisma.scrapedProduct.update({ where: { id }, data: { reviewStatus: 'IGNORED' } });
    }
    if (!dto.name || dto.price == null) {
      throw new BadRequestException('Informe nome e preço para aprovar.');
    }

    const slug = await this.uniqueSlug(dto.name, item.linkedProductId ?? undefined);
    const commercial = {
      name: dto.name.trim(),
      slug,
      description: dto.description?.trim() ?? '',
      price: dto.price,
      normalizedName: normalizeName(dto.name),
      teamId: dto.teamId || null,
      sportId: dto.sportId || null,
      genderId: dto.genderId || null,
      categoryId: dto.categoryId || null,
      seasonId: dto.seasonId || null,
      status: ProductStatus.APPROVED,
      isActive: dto.isActive ?? true,
      availableForOrder: dto.availableForOrder ?? true,
      isFeatured: dto.isFeatured ?? false,
      isLaunch: dto.isLaunch ?? false,
      availabilityNote: dto.availabilityNote?.trim() ?? '',
      orderNote: dto.orderNote?.trim() ?? '',
      sourceUrl: item.linkedProduct?.sourceUrl ?? item.sourceUrl,
      externalId: item.linkedProduct?.externalId ?? item.externalId,
    };

    const product = await this.prisma.$transaction(async (tx) => {
      const saved = item.linkedProductId
        ? await tx.product.update({
            where: { id: item.linkedProductId },
            data: {
              ...commercial,
              sourceUrl: item.linkedProduct?.sourceUrl || item.sourceUrl,
              externalId: item.linkedProduct?.externalId || item.externalId,
            },
          })
        : await tx.product.create({ data: commercial });

      await tx.productSize.deleteMany({ where: { productId: saved.id } });
      if (dto.sizeIds?.length) {
        await tx.productSize.createMany({
          data: dto.sizeIds.map((sizeId) => ({ productId: saved.id, sizeId })),
        });
      }

      if (dto.importImages !== false) {
        const existing = await tx.productImage.findMany({ where: { productId: saved.id } });
        const known = new Set(existing.map((image) => image.sha256).filter(Boolean));
        let order = existing.length;
        for (const image of item.images) {
          if (!image.url || (image.sha256 && known.has(image.sha256))) continue;
          await tx.productImage.create({
            data: {
              productId: saved.id,
              storageKey: image.storageKey || image.url,
              url: image.url,
              thumbUrl: image.thumbUrl,
              alt: dto.name || item.rawName,
              sortOrder: order,
              isPrimary: existing.length === 0 && order === 0,
              sha256: image.sha256,
              perceptualHash: image.perceptualHash,
              sourceUrl: image.sourceUrl,
            },
          });
          order += 1;
        }
      }

      await tx.scrapedProduct.update({
        where: { id },
        data: { reviewStatus: 'APPROVED', linkedProductId: saved.id },
      });
      await tx.scrapedProductChange.updateMany({ where: { scrapedProductId: id }, data: { applied: true } });
      return tx.product.findUniqueOrThrow({ where: { id: saved.id }, include: productInclude });
    });

    return serializeProduct(product);
  }

  async removeItem(id: string) {
    const item = await this.prisma.scrapedProduct.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item não encontrado.');
    await this.prisma.scrapedProduct.delete({ where: { id } });
    return { ok: true };
  }

  private async openJob(forced: boolean, sourceUrl: string, userId: string) {
    const cutoff = new Date(Date.now() - 45 * 60 * 1000);
    await this.prisma.scrapingJob.updateMany({
      where: { status: { in: ['QUEUED', 'RUNNING'] }, updatedAt: { lt: cutoff } },
      data: { status: 'FAILED', finishedAt: new Date(), errorLog: 'Execução interrompida antes de terminar.' },
    });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const active = await tx.scrapingJob.findFirst({ where: { status: { in: ['QUEUED', 'RUNNING'] } } });
        if (active) throw new ConflictException('Já existe uma varredura em execução.');
        return tx.scrapingJob.create({
          data: { status: 'QUEUED', forced, sourceUrl, triggeredById: userId },
        });
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ConflictException('Já existe uma varredura em execução.');
    }
  }

  private async runDiscovered(jobId: string, forced: boolean) {
    await this.prisma.scrapingJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    const albums = await discoverAlbums();
    await this.prisma.scrapingJob.update({ where: { id: jobId }, data: { foundCount: albums.length } });
    await this.runAlbums(jobId, albums, forced, true);
  }

  private async runAlbums(jobId: string, albums: AlbumRef[], forced: boolean, alreadyRunning = false) {
    if (!alreadyRunning) {
      await this.prisma.scrapingJob.update({
        where: { id: jobId },
        data: { status: 'RUNNING', startedAt: new Date(), foundCount: albums.length },
      });
    }
    const counts = { created: 0, existing: 0, changed: 0, suspect: 0, errors: 0 };
    const notes: string[] = [];
    for (const album of albums) {
      try {
        await this.ingest(jobId, album, forced, counts);
      } catch (error) {
        counts.errors += 1;
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        notes.push(`${album.url}: ${message}`);
        if (error instanceof SupplierBlockedError) {
          await this.finish(jobId, counts, notes, 'FAILED');
          return;
        }
        await this.prisma.scrapedProduct.create({
          data: {
            jobId,
            externalId: album.id,
            sourceUrl: album.url,
            rawName: album.title || album.id,
            rawDescription: message,
            normalizedName: normalizeName(album.title || album.id),
            matchStatus: 'ERROR',
            reviewStatus: 'PENDING',
          },
        });
      }
      await this.touch(jobId, albums.length, counts, notes);
      await sleep(900);
    }
    await this.finish(jobId, counts, notes, 'SUCCEEDED');
  }

  private async ingest(
    jobId: string,
    album: AlbumRef,
    forced: boolean,
    counts: { created: number; existing: number; changed: number; suspect: number; errors: number },
  ) {
    const detail = await readAlbum(album.url);
    const name = detail.title || album.title;
    const normalized = normalizeName(name);
    const byOrigin = await this.prisma.product.findFirst({
      where: { OR: [{ externalId: album.id }, { sourceUrl: album.url }] },
      include: { images: true },
    });

    const storedImages = await this.collectImages(detail.images, album.url, forced, byOrigin?.images ?? []);
    const coverHash = storedImages.find((image) => image.perceptualHash)?.perceptualHash ?? null;
    const suggestions = await this.suggest(name);

    let matchStatus: MatchStatus = 'NEW';
    let linkedProductId: string | null = byOrigin?.id ?? null;
    const changes: { field: string; previousValue: string; nextValue: string }[] = [];

    if (byOrigin) {
      if (normalizeName(byOrigin.name) !== normalized) {
        changes.push({ field: 'name', previousValue: byOrigin.name, nextValue: name });
      }
      if ((byOrigin.description || '') !== (detail.description || '')) {
        changes.push({ field: 'description', previousValue: byOrigin.description, nextValue: detail.description });
      }
      const known = new Set(byOrigin.images.map((image) => image.sha256).filter(Boolean));
      const fresh = storedImages.filter((image) => image.sha256 && !known.has(image.sha256));
      if (fresh.length) {
        changes.push({ field: 'images', previousValue: String(byOrigin.images.length), nextValue: String(fresh.length) });
      }
      matchStatus = changes.length ? 'CHANGED' : 'EXISTING';
      if (matchStatus === 'CHANGED') counts.changed += 1;
      else counts.existing += 1;
    }

    const suspects = byOrigin ? [] : await this.findSuspects(normalized, coverHash);
    if (!byOrigin && suspects.length) {
      matchStatus = 'SUSPECT_DUPLICATE';
      counts.suspect += 1;
    } else if (!byOrigin) {
      counts.created += 1;
    }

    const created = await this.prisma.scrapedProduct.create({
      data: {
        jobId,
        externalId: album.id,
        sourceUrl: album.url,
        rawName: name,
        rawDescription: detail.description,
        normalizedName: normalized,
        suggestedTeam: suggestions.team,
        suggestedGender: suggestions.gender,
        suggestedCategory: suggestions.category,
        suggestedSizes: suggestions.sizes,
        coverPerceptualHash: coverHash,
        matchStatus,
        reviewStatus: 'PENDING',
        linkedProductId,
        images: {
          create: storedImages.map((image, index) => ({
            sourceUrl: image.sourceUrl,
            storageKey: image.storageKey,
            url: image.url,
            thumbUrl: image.thumbUrl,
            sha256: image.sha256,
            perceptualHash: image.perceptualHash,
            sortOrder: index,
          })),
        },
        changes: { create: changes },
        duplicates: {
          create: suspects.map((suspect) => ({
            productId: suspect.productId,
            reason: suspect.reason,
            score: suspect.score,
          })),
        },
      },
    });
    return created;
  }

  private async collectImages(
    urls: string[],
    referer: string,
    forced: boolean,
    existing: { sourceUrl: string | null; storageKey: string; url: string; thumbUrl: string | null; sha256: string | null; perceptualHash: string | null }[],
  ) {
    const saved: {
      sourceUrl: string;
      storageKey: string | null;
      url: string | null;
      thumbUrl: string | null;
      sha256: string | null;
      perceptualHash: string | null;
    }[] = [];
    for (const sourceUrl of urls) {
      const previous = existing.find((image) => image.sourceUrl === sourceUrl);
      if (previous && !forced) {
        saved.push({
          sourceUrl,
          storageKey: previous.storageKey,
          url: previous.url,
          thumbUrl: previous.thumbUrl,
          sha256: previous.sha256,
          perceptualHash: previous.perceptualHash,
        });
        continue;
      }
      try {
        const bytes = await downloadImage(sourceUrl, referer);
        const stored = await this.media.save(bytes);
        saved.push({ sourceUrl, ...stored });
      } catch (error) {
        if (error instanceof SupplierBlockedError) throw error;
        this.logger.warn(`Imagem ignorada: ${sourceUrl}`);
      }
      await sleep(250);
    }
    return saved;
  }

  private async findSuspects(normalized: string, coverHash: string | null) {
    const products = await this.prisma.product.findMany({
      select: {
        id: true,
        normalizedName: true,
        images: { select: { perceptualHash: true }, where: { isPrimary: true }, take: 1 },
      },
    });
    const suspects: { productId: string; reason: 'NAME' | 'IMAGE' | 'BOTH'; score: number }[] = [];
    for (const product of products) {
      const nameScore = similarity(normalized, product.normalizedName);
      const hash = product.images[0]?.perceptualHash;
      const distance = coverHash && hash ? hammingHex(coverHash, hash) : 64;
      const nameHit = nameScore >= NAME_THRESHOLD;
      const imageHit = distance <= IMAGE_THRESHOLD;
      if (!nameHit && !imageHit) continue;
      suspects.push({
        productId: product.id,
        reason: nameHit && imageHit ? 'BOTH' : nameHit ? 'NAME' : 'IMAGE',
        score: nameHit ? nameScore : 1 - distance / 64,
      });
    }
    return suspects.slice(0, 5);
  }

  private async suggest(title: string) {
    const normalized = normalizeName(title);
    const [teams, genders, categories] = await Promise.all([
      this.prisma.team.findMany({ where: { isActive: true } }),
      this.prisma.gender.findMany({ where: { isActive: true } }),
      this.prisma.category.findMany({ where: { isActive: true } }),
    ]);
    const team = teams.find((item) => normalized.includes(normalizeName(item.name)))?.name ?? null;
    let gender = genders.find((item) => item.slug === 'masculino')?.name ?? null;
    if (/\b(women|womens|feminino|feminina|lady|ladies)\b/.test(normalized)) {
      gender = genders.find((item) => item.slug === 'feminino')?.name ?? gender;
    }
    if (/\b(kid|kids|infantil|youth|junior)\b/.test(normalized)) {
      gender = genders.find((item) => item.slug === 'infantil')?.name ?? gender;
    }
    let category: string | null = null;
    if (normalized.includes('retro')) category = categories.find((item) => item.slug === 'retro')?.name ?? null;
    else if (/training|treino|pre match/.test(normalized)) category = categories.find((item) => item.slug === 'treino')?.name ?? null;
    else if (normalized.includes('third')) category = categories.find((item) => item.slug === 'terceira-camisa')?.name ?? null;
    else if (normalized.includes('away')) category = categories.find((item) => item.slug === 'camisa-reserva')?.name ?? null;
    else if (normalized.includes('home')) category = categories.find((item) => item.slug === 'camisa-titular')?.name ?? null;
    const sizes = title.match(/S-\d?X{0,2}L|S-4XL|Size\s*\d+\s*-\s*\d+/i)?.[0] ?? null;
    return { team, gender, category, sizes };
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

  private async touch(
    jobId: string,
    foundCount: number,
    counts: { created: number; existing: number; changed: number; suspect: number; errors: number },
    notes: string[],
  ) {
    await this.prisma.scrapingJob.update({
      where: { id: jobId },
      data: {
        foundCount,
        newCount: counts.created,
        existingCount: counts.existing,
        changedCount: counts.changed,
        duplicateSuspectCount: counts.suspect,
        errorCount: counts.errors,
        errorLog: notes.join('\n').slice(0, 20000),
      },
    });
  }

  private async finish(
    jobId: string,
    counts: { created: number; existing: number; changed: number; suspect: number; errors: number },
    notes: string[],
    status: 'SUCCEEDED' | 'FAILED',
  ) {
    const job = await this.prisma.scrapingJob.findUnique({ where: { id: jobId } });
    await this.prisma.scrapingJob.update({
      where: { id: jobId },
      data: {
        status,
        finishedAt: new Date(),
        newCount: counts.created,
        existingCount: counts.existing,
        changedCount: counts.changed,
        duplicateSuspectCount: counts.suspect,
        errorCount: counts.errors,
        errorLog: notes.join('\n').slice(0, 20000),
        foundCount: job?.foundCount ?? 0,
      },
    });
  }

  private async fail(jobId: string, error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha inesperada na varredura.';
    this.logger.error(message);
    await this.prisma.scrapingJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', finishedAt: new Date(), errorLog: message.slice(0, 20000) },
    }).catch(() => undefined);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
