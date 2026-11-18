import { BadRequestException } from '@nestjs/common';

export function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'item';
}

export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const a = left.slice(0, 240);
  const b = right.slice(0, 240);
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[] = Array.from({ length: cols }, (_, index) => index);
  for (let i = 1; i < rows; i += 1) {
    let previous = i - 1;
    matrix[0] = i;
    for (let j = 1; j < cols; j += 1) {
      const current = matrix[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j] = Math.min(matrix[j] + 1, matrix[j - 1] + 1, previous + cost);
      previous = current;
    }
  }
  return matrix[cols - 1];
}

export function emptyToNull(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  return value;
}

export function assertUuidList(ids: string[] | undefined): string[] {
  if (!ids) return [];
  const unique = [...new Set(ids.filter(Boolean))];
  const valid = unique.every((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
  );
  if (!valid) throw new BadRequestException('Há um tamanho inválido na lista.');
  return unique;
}
