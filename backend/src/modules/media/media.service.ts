import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { perceptualHash } from '../../common/phash';

export type StoredImage = {
  storageKey: string;
  url: string;
  thumbUrl: string;
  sha256: string;
  perceptualHash: string;
};

@Injectable()
export class MediaService {
  private root() {
    return process.env.STORAGE_DIR || join(process.cwd(), 'storage');
  }

  async save(buffer: Buffer): Promise<StoredImage> {
    const meta = await sharp(buffer).metadata();
    if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
      throw new BadRequestException('Envie uma imagem JPEG, PNG ou WebP.');
    }

    const id = randomUUID();
    const year = String(new Date().getFullYear());
    const originalDir = join(this.root(), 'originals', year);
    const derivedDir = join(this.root(), 'derived');
    await mkdir(originalDir, { recursive: true });
    await mkdir(derivedDir, { recursive: true });

    const extension = meta.format === 'png' ? 'png' : meta.format === 'webp' ? 'webp' : 'jpg';
    const storageKey = `originals/${year}/${id}.${extension}`;
    await writeFile(join(this.root(), storageKey), buffer);

    const pipeline = sharp(buffer).rotate();
    await Promise.all([
      pipeline.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(derivedDir, `${id}-1600.webp`)),
      pipeline.clone().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 76 }).toFile(join(derivedDir, `${id}-480.webp`)),
    ]);

    return {
      storageKey,
      url: `/media/derived/${id}-1600.webp`,
      thumbUrl: `/media/derived/${id}-480.webp`,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      perceptualHash: await perceptualHash(buffer),
    };
  }

  async discardUnreferenced(
    scraped: { storageKey: string | null; url: string | null; thumbUrl: string | null }[],
    published: { storageKey: string | null; url: string | null; thumbUrl: string | null }[],
  ) {
    const used = new Set<string>();
    for (const image of published) this.remember(used, image);
    for (const image of scraped) {
      if (image.storageKey && !used.has(image.storageKey)) {
        await unlink(join(this.root(), image.storageKey)).catch(() => undefined);
      }
      for (const publicUrl of [image.url, image.thumbUrl]) {
        const relative = this.relativeMedia(publicUrl);
        if (!relative || used.has(relative)) continue;
        await unlink(join(this.root(), relative)).catch(() => undefined);
      }
    }
  }

  private remember(used: Set<string>, image: { storageKey: string | null; url: string | null; thumbUrl: string | null }) {
    if (image.storageKey) used.add(image.storageKey);
    for (const publicUrl of [image.url, image.thumbUrl]) {
      const relative = this.relativeMedia(publicUrl);
      if (relative) used.add(relative);
    }
  }

  private relativeMedia(publicUrl: string | null) {
    if (!publicUrl?.startsWith('/media/')) return '';
    return publicUrl.slice('/media/'.length);
  }
}
