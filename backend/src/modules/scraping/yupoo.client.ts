import { parse, HTMLElement } from 'node-html-parser';

const USER_AGENT = 'Mozilla/5.0 (compatible; CamisasStore/1.0; +catalog-import)';
export const DEFAULT_CATEGORY_URL = 'https://minkang.x.yupoo.com/categories/720316?isSubCate=true';
const CATEGORY_URL = () => process.env.YUPOO_CATEGORY_URL || DEFAULT_CATEGORY_URL;

export class SupplierBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupplierBlockedError';
  }
}

export type AlbumRef = {
  id: string;
  url: string;
  title: string;
  cover?: string;
  team?: string;
  country?: string;
  national?: boolean;
};

export type CatalogDiscovery = {
  championship: string;
  albums: AlbumRef[];
};

export type AlbumDetail = {
  title: string;
  description: string;
  images: string[];
};

export async function discoverAlbums(canContinue?: () => Promise<boolean>): Promise<AlbumRef[] | null> {
  return collectAlbums(CATEGORY_URL(), canContinue);
}

export async function discoverCatalog(categoryUrl: string, canContinue?: () => Promise<boolean>): Promise<CatalogDiscovery | null> {
  const page = new URL(categoryUrl);
  const html = await fetchText(page.toString());
  const currentId = page.pathname.match(/\/categories\/(\d+)/)?.[1] || '';
  const crumbs = categoryCrumbs(html);
  const current = crumbs[crumbs.length - 1]?.title || 'Campeonato';
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2].title : '';
  const teams = sidebarTeams(html, page.origin);
  const currentIsTeam = teams.some((team) => team.id === currentId);
  if (!currentIsTeam && teams.length) {
    const seen = new Map<string, AlbumRef>();
    for (const team of teams) {
      if (canContinue && !(await canContinue())) return null;
      const albums = await collectAlbums(team.url, canContinue);
      if (!albums) return null;
      for (const album of albums) {
        if (!seen.has(album.id)) seen.set(album.id, { ...album, team: team.name });
      }
      await sleep(120);
    }
    return { championship: current, albums: [...seen.values()] };
  }
  const albums = await collectAlbums(page.toString(), canContinue);
  if (!albums) return null;
  const team = currentIsTeam ? current : undefined;
  return {
    championship: parent || current,
    albums: albums.map((album) => ({ ...album, team })),
  };
}

async function collectAlbums(categoryUrl: string, canContinue?: () => Promise<boolean>): Promise<AlbumRef[] | null> {
  const first = new URL(categoryUrl);
  const seen = new Map<string, AlbumRef>();
  for (let page = 1; page <= 40; page += 1) {
    if (canContinue && !(await canContinue())) return null;
    const url = new URL(first.toString());
    if (page > 1) url.searchParams.set('page', String(page));
    const html = await fetchText(url.toString());
    const found = parseCategory(html, url.origin);
    const before = seen.size;
    for (const album of found) seen.set(album.id, album);
    if (!found.length || seen.size === before) break;
    await sleep(120);
  }
  return [...seen.values()];
}

export async function readAlbum(url: string): Promise<AlbumDetail> {
  const html = await fetchText(url);
  const root = parse(html);
  const title =
    clean(root.querySelector('.showalbumheader__gallerytitle')?.text) ||
    clean(root.querySelector('h1')?.text) ||
    clean(root.querySelector('title')?.text) ||
    'Produto sem nome';
  const description = clean(
    root.querySelector('.showalbumheader__gallerysubtitle')?.text ||
      root.querySelector('.showalbumheader__desc')?.text ||
      '',
  ).slice(0, 5000);
  const images: string[] = [];
  for (const image of root.querySelectorAll('img')) {
    const raw = image.getAttribute('data-origin-src') || image.getAttribute('data-src') || '';
    pushImage(images, raw);
    if (images.length >= 16) break;
  }
  if (!images.length) {
    pushImage(images, root.querySelector('meta[property="og:image"]')?.getAttribute('content') || '');
  }
  return { title: title.slice(0, 240), description, images };
}

export async function downloadImage(url: string, referer: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Referer: referer, Accept: 'image/*' },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401 || response.status === 403 || response.status === 429) {
    throw new SupplierBlockedError(`Imagem bloqueada pelo fornecedor (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(`Falha ao baixar imagem (HTTP ${response.status}).`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 8 * 1024 * 1024) throw new Error('Imagem maior que o limite de 8 MB.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Imagem maior que o limite de 8 MB.');
  return bytes;
}

export function isCategoryUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.endsWith('yupoo.com') && /\/categories\/\d+/.test(url.pathname);
  } catch {
    return false;
  }
}

export function albumIdFromUrl(raw: string): AlbumRef | null {
  const album = albumUrl(raw, raw);
  if (!album) return null;
  return { ...album, title: `Álbum ${album.id}` };
}

function categoryCrumbs(html: string) {
  const root = parse(html);
  return root
    .querySelectorAll('.yupoo-crumbs .yupoo-crumbs-span')
    .map((item) => ({
      title: clean(item.getAttribute('title') || item.text),
      href: item.getAttribute('href') || '',
    }))
    .filter((item) => item.title && item.title !== '全部分类');
}

function sidebarTeams(html: string, origin: string) {
  const root = parse(html);
  const box = root.querySelector('.categories__box-right-categories');
  if (!box) return [];
  const teams: { id: string; name: string; url: string }[] = [];
  for (const anchor of box.querySelectorAll('a.categories__box-right-category-item')) {
    const href = anchor.getAttribute('href') || '';
    let url: URL;
    try {
      url = new URL(href, origin);
    } catch {
      continue;
    }
    const id = url.pathname.match(/\/categories\/(\d+)/)?.[1];
    if (!id || id === '0') continue;
    const name = clean(anchor.getAttribute('title') || anchor.text);
    if (!name || teams.some((team) => team.id === id)) continue;
    if (!url.searchParams.has('isSubCate')) url.searchParams.set('isSubCate', 'true');
    url.hash = '';
    teams.push({ id, name, url: url.toString() });
  }
  return teams;
}

function parseCategory(html: string, origin: string): AlbumRef[] {
  const root = parse(html);
  if (looksBlocked(html)) {
    throw new SupplierBlockedError('O fornecedor exigiu verificação ou bloqueou a leitura automática.');
  }
  const albums: AlbumRef[] = [];
  const anchors = root.querySelectorAll('a');
  for (const anchor of anchors) {
    const href = anchor.getAttribute('href') || '';
    if (!href.includes('/albums/')) continue;
    const album = albumUrl(href, origin);
    if (!album || albums.some((item) => item.id === album.id)) continue;
    const cover = absolutize(
      anchor.querySelector('img')?.getAttribute('data-origin-src') ||
        anchor.querySelector('img')?.getAttribute('data-src') ||
        anchor.querySelector('img')?.getAttribute('src') ||
        '',
    );
    albums.push({
      id: album.id,
      url: album.url,
      title: titleFrom(anchor),
      cover: cover || undefined,
    });
  }
  return albums;
}

function titleFrom(anchor: HTMLElement) {
  const titled = clean(anchor.querySelector('.album__title')?.text || anchor.getAttribute('title') || anchor.text);
  return titled.slice(0, 240) || 'Produto sem nome';
}

function looksBlocked(html: string) {
  const sample = html.slice(0, 4000).toLowerCase();
  return sample.includes('captcha') || sample.includes('verify you are human') || sample.includes('access denied');
}

async function fetchText(url: string, attempt = 1): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(20000),
      redirect: 'follow',
    });
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      throw new SupplierBlockedError(`Fornecedor recusou a consulta (HTTP ${response.status}).`);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
    return await response.text();
  } catch (error) {
    if (error instanceof SupplierBlockedError || attempt >= 3) throw error;
    await sleep(700 * attempt);
    return fetchText(url, attempt + 1);
  }
}

function albumUrl(href: string, origin: string) {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }
  if (!url.hostname.endsWith('yupoo.com')) return null;
  const match = url.pathname.match(/\/albums\/(\d+)/);
  if (!match) return null;
  if (!url.searchParams.has('uid')) url.searchParams.set('uid', '1');
  url.hash = '';
  return { id: match[1], url: url.toString() };
}

function pushImage(images: string[], raw: string) {
  const absolute = absolutize(raw);
  if (!absolute || images.includes(absolute)) return;
  if (/logo|icon|avatar|loading/i.test(absolute)) return;
  images.push(absolute);
}

function absolutize(value: string) {
  const raw = value.trim();
  if (!raw || raw.startsWith('data:')) return '';
  if (raw.startsWith('//')) return `https:${raw}`;
  return raw;
}

function clean(value?: string) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
