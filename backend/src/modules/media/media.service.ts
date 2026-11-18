import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
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
    await pipeline.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(derivedDir, `${id}-1600.webp`));
    await pipeline.clone().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 76 }).toFile(join(derivedDir, `${id}-480.webp`));

    return {
      storageKey,
      url: `/media/derived/${id}-1600.webp`,
      thumbUrl: `/media/derived/${id}-480.webp`,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      perceptualHash: await perceptualHash(buffer),
    };
  }
}
