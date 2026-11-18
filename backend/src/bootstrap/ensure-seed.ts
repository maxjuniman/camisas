import bcrypt from 'bcryptjs';
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { slugify } from '../common/text';

const logger = new Logger('Seed');

const groups: Record<string, { name: string; sortOrder?: number }[]> = {
  team: [
    { name: 'Grêmio' },
    { name: 'Internacional' },
    { name: 'Barcelona' },
    { name: 'Real Madrid' },
    { name: 'Manchester City' },
  ],
  sport: [{ name: 'Futebol' }, { name: 'Basquete' }],
  gender: [
    { name: 'Masculino', sortOrder: 1 },
    { name: 'Feminino', sortOrder: 2 },
    { name: 'Infantil', sortOrder: 3 },
    { name: 'Unissex', sortOrder: 4 },
  ],
  category: [
    { name: 'Camisa titular' },
    { name: 'Camisa reserva' },
    { name: 'Terceira camisa' },
    { name: 'Treino' },
    { name: 'Retrô' },
  ],
  season: [{ name: '2025/26' }, { name: '2026/27' }],
  size: [
    { name: 'PP', sortOrder: 10 },
    { name: 'P', sortOrder: 20 },
    { name: 'M', sortOrder: 30 },
    { name: 'G', sortOrder: 40 },
    { name: 'GG', sortOrder: 50 },
    { name: 'XG', sortOrder: 60 },
    { name: '3G', sortOrder: 70 },
    { name: '4G', sortOrder: 80 },
  ],
};

export async function ensureSeed(prisma: PrismaClient) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrador';
  const users = await prisma.user.count();

  if (users === 0) {
    if (!email || !password || password.length < 8) {
      throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo de 8 caracteres) para criar o administrador.');
    }
    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    logger.log(`Administrador criado para ${email}`);
  }

  await seedGroup(prisma, 'team', groups.team);
  await seedGroup(prisma, 'sport', groups.sport);
  await seedGroup(prisma, 'gender', groups.gender);
  await seedGroup(prisma, 'category', groups.category);
  await seedGroup(prisma, 'season', groups.season);
  await seedGroup(prisma, 'size', groups.size);
}

async function seedGroup(
  prisma: PrismaClient,
  kind: 'team' | 'sport' | 'gender' | 'category' | 'season' | 'size',
  items: { name: string; sortOrder?: number }[],
) {
  for (const [index, item] of items.entries()) {
    const slug = slugify(item.name);
    const data = { name: item.name, slug, sortOrder: item.sortOrder ?? (index + 1) * 10 };
    if (kind === 'team') await prisma.team.upsert({ where: { slug }, update: {}, create: data });
    if (kind === 'sport') await prisma.sport.upsert({ where: { slug }, update: {}, create: data });
    if (kind === 'gender') await prisma.gender.upsert({ where: { slug }, update: {}, create: data });
    if (kind === 'category') await prisma.category.upsert({ where: { slug }, update: {}, create: data });
    if (kind === 'season') await prisma.season.upsert({ where: { slug }, update: {}, create: data });
    if (kind === 'size') await prisma.size.upsert({ where: { slug }, update: {}, create: data });
  }
}
