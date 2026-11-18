import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MatchStatus, Prisma, ProductStatus } from '@prisma/client';
import { hammingHex } from '../../common/phash';
import { productInclude, serializeProduct } from '../../common/serialize';
import { normalizeName, similarity, slugify } from '../../common/text';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { countryFromChampionship, friendlyName, parseSizeNames, publicTeamName, sizeSortOrder } from './catalog-name';
import { ImportUrlsDto, ReviewDto } from './dto/scraping.dto';
import {
  AlbumRef,
  DEFAULT_CATEGORY_URL,
  SupplierBlockedError,
  albumIdFromUrl,
  discoverAlbums,
  isCategoryUrl,
  discoverCatalog,
  downloadImage,
  readAlbum,
} from './yupoo.client';

const NAME_THRESHOLD = 0.88;
const IMAGE_THRESHOLD = 10;

class JobStopped extends Error {
  constructor() {
    super('Importação interrompida.');
    this.name = 'JobStopped';
  }
}

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);
  private readonly running = new Set<string>();
  private epoch = 0;
  private readonly jobEpoch = new Map<string, number>();

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

  categoryUrl() {
    return process.env.YUPOO_CATEGORY_URL || DEFAULT_CATEGORY_URL;
  }

  async listItems(reviewStatus?: string) {
    if (!reviewStatus || reviewStatus === 'PENDING') await this.settleKnownCatalog();
    const items = await this.prisma.scrapedProduct.findMany({
      where: reviewStatus ? { reviewStatus: reviewStatus as 'PENDING' | 'APPROVED' | 'IGNORED' } : undefined,
      include: { images: { orderBy: { sortOrder: 'asc' } }, duplicates: { include: { product: true } }, changes: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return items.map((item) => this.withDisplayName(item));
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
      ...this.withDisplayName(item),
      linkedProduct: item.linkedProduct ? serializeProduct(item.linkedProduct) : null,
      duplicates: item.duplicates.map((candidate) => ({
        ...candidate,
        product: serializeProduct(candidate.product),
      })),
    };
  }

  async start(forced: boolean, userId: string) {
    const job = await this.openJob(forced, this.categoryUrl(), userId);
    this.launch(job.id, () => this.runDiscovered(job.id, forced));
    return job;
  }

  async importUrls(dto: ImportUrlsDto, userId: string) {
    const single = dto.url?.trim();
    if (single) {
      if (isCategoryUrl(single)) {
        const job = await this.openJob(false, single, userId);
        this.launch(job.id, () => this.runCategory(job.id, single, false));
        return job;
      }
      const album = albumIdFromUrl(single);
      if (!album) throw new BadRequestException('Informe o link de um campeonato ou de um álbum do Yupoo.');
      const job = await this.openJob(false, single, userId);
      await this.prisma.scrapingJob.update({
        where: { id: job.id },
        data: { queue: [album] as unknown as Prisma.InputJsonValue, foundCount: 1, cursor: 0 },
      });
      this.launch(job.id, () => this.runAlbums(job.id, [album], false, true));
      return job;
    }
    const albums = (dto.urls || []).map((url) => {
      const parsed = albumIdFromUrl(url);
      if (!parsed) throw new BadRequestException('Informe apenas links de álbuns do Yupoo.');
      return parsed;
    });
    if (!albums.length) throw new BadRequestException('Informe o link do campeonato.');
    const job = await this.openJob(true, 'importacao-manual', userId);
    await this.prisma.scrapingJob.update({
      where: { id: job.id },
      data: { queue: albums as unknown as Prisma.InputJsonValue, foundCount: albums.length, cursor: 0 },
    });
    this.launch(job.id, () => this.runAlbums(job.id, albums, true, true));
    return job;
  }

  async pause(id: string) {
    const job = await this.prisma.scrapingJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Varredura não encontrada.');
    if (job.status !== 'RUNNING' && job.status !== 'QUEUED') {
      throw new ConflictException('Só é possível pausar uma importação em execução.');
    }
    return this.prisma.scrapingJob.update({ where: { id }, data: { status: 'PAUSED' } });
  }

  async resume(id: string) {
    const job = await this.prisma.scrapingJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Varredura não encontrada.');
    if (job.status !== 'PAUSED') throw new ConflictException('Essa importação não está pausada.');
    const updated = await this.prisma.scrapingJob.update({
      where: { id },
      data: { status: 'RUNNING', finishedAt: null },
    });
    if (!this.running.has(id)) this.launch(id, () => this.continuePaused(id));
    return updated;
  }

  async reset() {
    this.epoch += 1;
    await this.prisma.scrapingJob.updateMany({
      where: { status: { in: ['QUEUED', 'RUNNING', 'PAUSED'] } },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        errorLog: 'Importação zerada pelo administrador.',
      },
    });
    await sleep(800);
    const scraped = await this.prisma.scrapedImage.findMany({
      select: { storageKey: true, url: true, thumbUrl: true },
    });
    const published = await this.prisma.productImage.findMany({
      select: { storageKey: true, url: true, thumbUrl: true },
    });
    const removed = await this.prisma.scrapingJob.deleteMany();
    await this.media.discardUnreferenced(scraped, published);
    return { jobs: removed.count };
  }

  async approveWithoutReview(price = 0) {
    const pending = await this.prisma.scrapedProduct.findMany({
      where: { reviewStatus: 'PENDING' },
      include: { images: { orderBy: { sortOrder: 'asc' } }, linkedProduct: true },
      orderBy: { createdAt: 'asc' },
    });
    const [teams, sports, genders, categories, seasons, sizes] = await Promise.all([
      this.prisma.team.findMany({ where: { isActive: true } }),
      this.prisma.sport.findMany({ where: { isActive: true } }),
      this.prisma.gender.findMany({ where: { isActive: true } }),
      this.prisma.category.findMany({ where: { isActive: true } }),
      this.prisma.season.findMany({ where: { isActive: true } }),
      this.prisma.size.findMany({ where: { isActive: true } }),
    ]);
    let approved = 0;
    let skipped = 0;
    for (const item of pending) {
      if (item.matchStatus === 'ERROR' || item.matchStatus === 'SUSPECT_DUPLICATE') {
        skipped += 1;
        continue;
      }
      if (item.linkedProductId) {
        await this.copyImages(item.linkedProductId, item.images, item.displayName || item.rawName);
        await this.prisma.scrapedProduct.update({ where: { id: item.id }, data: { reviewStatus: 'APPROVED' } });
        approved += 1;
        continue;
      }
      const name = (item.displayName || friendlyName(item.rawName) || item.rawName).trim();
      if (name.length < 2) {
        skipped += 1;
        continue;
      }
      const team = teams.find((entry) => entry.name.toLowerCase() === (item.suggestedTeam || '').toLowerCase());
      const sportId = team?.sportId || sports.find((entry) => entry.slug === 'futebol')?.id;
      const gender = genders.find((entry) => entry.name.toLowerCase() === (item.suggestedGender || '').toLowerCase());
      const category = categories.find((entry) => entry.name.toLowerCase() === (item.suggestedCategory || '').toLowerCase());
      const seasonMatch = item.rawName.match(/\b(\d{2})\/(\d{2})\b/);
      const season = seasonMatch ? seasons.find((entry) => entry.name === `20${seasonMatch[1]}/${seasonMatch[2]}`) : undefined;
      const wanted = new Set((item.suggestedSizes || '').split(',').map((size) => size.trim().toLowerCase()).filter(Boolean));
      const sizeIds = sizes.filter((size) => wanted.has(size.name.toLowerCase())).map((size) => size.id);
      await this.review(item.id, {
        action: 'approve',
        name,
        description: item.rawDescription,
        price,
        teamId: team?.id,
        sportId,
        countryId: team?.countryId || undefined,
        genderId: gender?.id,
        categoryId: category?.id,
        seasonId: season?.id,
        sizeIds,
        importImages: true,
        isActive: true,
        availableForOrder: true,
      });
      approved += 1;
    }
    return { approved, skipped };
  }

  private async copyImages(
    productId: string,
    images: { url: string | null; thumbUrl: string | null; storageKey: string | null; sha256: string | null; perceptualHash: string | null; sourceUrl: string }[],
    alt: string,
  ) {
    const existing = await this.prisma.productImage.findMany({ where: { productId } });
    const known = new Set(existing.map((image) => image.sha256).filter(Boolean));
    let order = existing.length;
    for (const image of images) {
      if (!image.url || (image.sha256 && known.has(image.sha256))) continue;
      await this.prisma.productImage.create({
        data: {
          productId,
          storageKey: image.storageKey || image.url,
          url: image.url,
          thumbUrl: image.thumbUrl,
          alt,
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
    const publicName = dto.name.trim();

    const slug = await this.uniqueSlug(publicName, item.linkedProductId ?? undefined);
    const commercial = {
      name: publicName,
      slug,
      description: dto.description?.trim() ?? '',
      price: dto.price,
      normalizedName: normalizeName(dto.name),
      teamId: dto.teamId || null,
      sportId: dto.sportId || null,
      countryId: dto.countryId || null,
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
        data: { reviewStatus: 'APPROVED', linkedProductId: saved.id, displayName: publicName },
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
        const active = await tx.scrapingJob.findFirst({ where: { status: { in: ['QUEUED', 'RUNNING', 'PAUSED'] } } });
        if (active?.status === 'PAUSED') {
          throw new ConflictException('Há uma importação pausada. Retome essa execução antes de iniciar outra.');
        }
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

  private launch(jobId: string, work: () => Promise<void>) {
    this.jobEpoch.set(jobId, this.epoch);
    setImmediate(() => {
      void this.guard(jobId, work);
    });
  }

  private async guard(jobId: string, work: () => Promise<void>) {
    if (this.running.has(jobId)) return;
    this.running.add(jobId);
    try {
      await work();
    } catch (error) {
      if (error instanceof JobStopped) return;
      await this.fail(jobId, error);
    } finally {
      this.running.delete(jobId);
      this.jobEpoch.delete(jobId);
    }
  }

  private async runCategory(jobId: string, url: string, forced: boolean) {
    if (!(await this.waitIfPaused(jobId))) return;
    await this.prisma.scrapingJob.update({
      where: { id: jobId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        queue: { mode: 'category', url } as Prisma.InputJsonValue,
      },
    });
    const catalog = await discoverCatalog(url, () => this.waitIfPaused(jobId));
    if (!catalog) return;
    if (!catalog.albums.length) {
      await this.finish(jobId, { created: 0, existing: 0, changed: 0, suspect: 0, errors: 0 }, ['Nenhuma camisa encontrada nesse link.'], 'FAILED');
      return;
    }
    const country = countryFromChampionship(catalog.championship);
    const albums = catalog.albums.map((album) => ({ ...album, country }));
    const names = [...new Set(albums.map((album) => album.team).filter((team): team is string => Boolean(team)))];
    const canonical = new Map<string, string>();
    for (const name of names) canonical.set(name, await this.ensureTeam(name, country));
    for (const album of albums) {
      if (album.team) album.team = canonical.get(album.team) || album.team;
    }
    await this.prisma.scrapingJob.update({
      where: { id: jobId },
      data: { queue: albums as unknown as Prisma.InputJsonValue, foundCount: albums.length, cursor: 0 },
    });
    await this.runAlbums(jobId, albums, forced, true);
  }

  private async runDiscovered(jobId: string, forced: boolean) {
    if (!(await this.waitIfPaused(jobId))) return;
    await this.prisma.scrapingJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    const albums = await discoverAlbums(() => this.waitIfPaused(jobId));
    if (!albums) return;
    await this.prisma.scrapingJob.update({
      where: { id: jobId },
      data: { queue: albums as unknown as Prisma.InputJsonValue, foundCount: albums.length, cursor: 0 },
    });
    await this.runAlbums(jobId, albums, forced, true);
  }

  private async continuePaused(jobId: string) {
    const job = await this.prisma.scrapingJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'RUNNING') return;
    const stored = this.readQueue(job.queue);
    if (!stored) {
      const category = this.readCategory(job.queue);
      if (category) {
        await this.runCategory(jobId, category, job.forced);
        return;
      }
      await this.runDiscovered(jobId, job.forced);
      return;
    }
    const notes = job.errorLog ? job.errorLog.split('\n').filter(Boolean) : [];
    await this.runAlbums(
      jobId,
      stored,
      job.forced,
      true,
      job.cursor,
      {
        created: job.newCount,
        existing: job.existingCount,
        changed: job.changedCount,
        suspect: job.duplicateSuspectCount,
        errors: job.errorCount,
      },
      notes,
    );
  }

  private async runAlbums(
    jobId: string,
    albums: AlbumRef[],
    forced: boolean,
    alreadyRunning = false,
    startIndex = 0,
    counts = { created: 0, existing: 0, changed: 0, suspect: 0, errors: 0 },
    notes: string[] = [],
  ) {
    if (!alreadyRunning) {
      await this.prisma.scrapingJob.update({
        where: { id: jobId },
        data: { status: 'RUNNING', startedAt: new Date(), foundCount: albums.length },
      });
    }
    for (let index = startIndex; index < albums.length; index += 1) {
      if (!(await this.waitIfPaused(jobId))) return;
      const album = albums[index];
      try {
        await this.ingest(jobId, album, forced, counts);
      } catch (error) {
        if (error instanceof JobStopped) return;
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
            displayName: friendlyName(album.title || album.id),
            rawDescription: message,
            normalizedName: normalizeName(album.title || album.id),
            matchStatus: 'ERROR',
            reviewStatus: 'PENDING',
          },
        });
      }
      await this.touch(jobId, albums.length, counts, notes, index + 1);
      if (!(await this.waitIfPaused(jobId))) return;
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
    if (!(await this.waitIfPaused(jobId))) throw new JobStopped();
    const detail = await readAlbum(album.url);
    const name = detail.title || album.title;
    const normalized = normalizeName(name);
    const byOrigin = await this.prisma.product.findFirst({
      where: { OR: [{ externalId: album.id }, { sourceUrl: album.url }] },
      include: { images: true },
    });

    const storedImages = await this.collectImages(detail.images, album.url, forced, byOrigin?.images ?? [], jobId);
    const coverHash = storedImages.find((image) => image.perceptualHash)?.perceptualHash ?? null;
    const sizeNames = parseSizeNames(name);
    await this.ensureSizes(sizeNames);
    const suggestions = await this.suggest(name, sizeNames);
    if (album.team) suggestions.team = await this.ensureTeam(album.team, album.country);

    let matchStatus: MatchStatus = 'NEW';
    let linkedProductId: string | null = byOrigin?.id ?? null;
    const changes: { field: string; previousValue: string; nextValue: string }[] = [];

    if (byOrigin) {
      const previous = await this.prisma.scrapedProduct.findFirst({
        where: { linkedProductId: byOrigin.id, reviewStatus: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
      });
      if (previous && normalizeName(previous.rawName) !== normalized) {
        changes.push({ field: 'name', previousValue: previous.rawName, nextValue: name });
      }
      if (previous && (previous.rawDescription || '') !== (detail.description || '')) {
        changes.push({ field: 'description', previousValue: previous.rawDescription, nextValue: detail.description });
      }
      const knownSources = new Set(byOrigin.images.map((image) => image.sourceUrl).filter((url): url is string => Boolean(url)));
      const knownHashes = new Set(byOrigin.images.map((image) => image.sha256).filter((hash): hash is string => Boolean(hash)));
      const fresh = storedImages.filter((image) => {
        if (image.sourceUrl && knownSources.has(image.sourceUrl)) return false;
        if (image.sha256 && knownHashes.has(image.sha256)) return false;
        return true;
      });
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
        displayName: friendlyName(name),
        rawDescription: detail.description,
        normalizedName: normalized,
        suggestedTeam: suggestions.team,
        suggestedGender: suggestions.gender,
        suggestedCategory: suggestions.category,
        suggestedSizes: suggestions.sizes,
        coverPerceptualHash: coverHash,
        matchStatus,
        reviewStatus: matchStatus === 'EXISTING' ? 'APPROVED' : 'PENDING',
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
    jobId: string,
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
      if (!(await this.waitIfPaused(jobId))) throw new JobStopped();
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

  private async settleKnownCatalog() {
    const pending = await this.prisma.scrapedProduct.findMany({
      where: {
        reviewStatus: 'PENDING',
        linkedProductId: { not: null },
        matchStatus: { in: ['EXISTING', 'CHANGED'] },
      },
      include: { changes: true, linkedProduct: { select: { name: true, description: true } } },
    });
    const ids = pending.filter((item) => this.alreadyInCatalog(item)).map((item) => item.id);
    if (!ids.length) return;
    await this.prisma.scrapedProduct.updateMany({
      where: { id: { in: ids } },
      data: { reviewStatus: 'APPROVED' },
    });
  }

  private alreadyInCatalog(item: {
    matchStatus: MatchStatus;
    changes: { field: string; previousValue: string }[];
    linkedProduct: { name: string; description: string } | null;
  }) {
    if (!item.linkedProduct) return false;
    if (item.matchStatus === 'EXISTING') return true;
    if (item.matchStatus !== 'CHANGED' || item.changes.some((change) => change.field === 'images')) return false;
    return item.changes.every((change) => {
      if (change.field === 'name') return normalizeName(change.previousValue) === normalizeName(item.linkedProduct!.name);
      if (change.field === 'description') return (change.previousValue || '') === (item.linkedProduct!.description || '');
      return false;
    });
  }

  private withDisplayName<T extends { rawName: string; displayName: string }>(item: T): T {
    return { ...item, displayName: item.displayName || friendlyName(item.rawName) };
  }

  private async ensureTeam(rawName: string, countryName?: string) {
    const name = publicTeamName(rawName);
    const existing = await this.prisma.team.findMany({
      select: { id: true, name: true, sportId: true, countryId: true },
    });
    const found = existing.find(
      (team) => normalizeName(team.name) === normalizeName(name) || normalizeName(team.name) === normalizeName(rawName),
    );
    const sport = await this.prisma.sport.findFirst({ where: { slug: 'futebol', isActive: true } });
    const country = countryName ? await this.ensureCountry(countryName) : null;
    if (found) {
      const data: { sportId?: string; countryId?: string } = {};
      if (!found.sportId && sport) data.sportId = sport.id;
      if (!found.countryId && country) data.countryId = country.id;
      if (Object.keys(data).length) await this.prisma.team.update({ where: { id: found.id }, data });
      return found.name;
    }
    let slug = slugify(name);
    let index = 2;
    while (await this.prisma.team.findUnique({ where: { slug } })) {
      slug = `${slugify(name)}-${index}`;
      index += 1;
    }
    const created = await this.prisma.team.create({
      data: { name, slug, sportId: sport?.id, countryId: country?.id, sortOrder: existing.length },
    });
    return created.name;
  }

  private async ensureCountry(name: string) {
    const slug = slugify(name);
    return this.prisma.country.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
  }

  private async ensureSizes(names: string[]) {
    for (const name of names) {
      const slug = slugify(name);
      await this.prisma.size.upsert({
        where: { slug },
        update: {},
        create: { name, slug, sortOrder: sizeSortOrder(name) },
      });
    }
  }

  private async suggest(title: string, sizeNames: string[]) {
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
    return { team, gender, category, sizes: sizeNames.length ? sizeNames.join(', ') : null };
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
    cursor?: number,
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
        cursor,
      },
    });
  }

  private async waitIfPaused(jobId: string) {
    while (true) {
      if (this.jobEpoch.get(jobId) !== this.epoch) return false;
      const job = await this.prisma.scrapingJob.findUnique({ where: { id: jobId }, select: { status: true } });
      if (!job || job.status === 'FAILED' || job.status === 'SUCCEEDED') return false;
      if (job.status !== 'PAUSED') return true;
      await sleep(1000);
    }
  }

  private readCategory(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    if (row.mode !== 'category' || typeof row.url !== 'string' || !isCategoryUrl(row.url)) return null;
    return row.url;
  }

  private readQueue(value: Prisma.JsonValue | null): AlbumRef[] | null {
    if (!Array.isArray(value) || value.length === 0) return null;
    const albums: AlbumRef[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== 'string' || typeof row.url !== 'string' || typeof row.title !== 'string') return null;
      albums.push({
        id: row.id,
        url: row.url,
        title: row.title,
        cover: typeof row.cover === 'string' ? row.cover : undefined,
        team: typeof row.team === 'string' ? row.team : undefined,
        country: typeof row.country === 'string' ? row.country : undefined,
      });
    }
    return albums;
  }

  private async finish(
    jobId: string,
    counts: { created: number; existing: number; changed: number; suspect: number; errors: number },
    notes: string[],
    status: 'SUCCEEDED' | 'FAILED',
  ) {
    const job = await this.prisma.scrapingJob.findUnique({ where: { id: jobId } });
    if (!job || this.jobEpoch.get(jobId) !== this.epoch) return;
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
