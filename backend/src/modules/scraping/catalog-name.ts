const ADULT_SIZES = ['P', 'M', 'G', 'GG', 'XG', '3G', '4G'];

const KNOWN_TEAMS = [
  'Red Bull Bragantino',
  'Atlético Paranaense',
  'Atlético Mineiro',
  'Atlético Juventus',
  'Vasco da Gama',
  'Sport Recife',
  'São Paulo',
  'Santa Cruz',
  'Chapecoense',
  'Corinthians',
  'Internacional',
  'Fluminense',
  'Palmeiras',
  'Botafogo',
  'Fortaleza',
  'Confiança',
  'Coritiba',
  'Cruzeiro',
  'Flamengo',
  'Santos',
  'Grêmio',
  'Náutico',
  'Cuiabá',
  'Vitória',
  'Ceará',
  'Bahia',
  'Paysandu',
  'Remo',
];

export function publicTeamName(raw: string): string {
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  const known = [...KNOWN_TEAMS].sort((a, b) => b.length - a.length).find((name) => {
    const key = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    return normalized === key || normalized.startsWith(`${key} `);
  });
  return known || raw.replace(/\s+/g, ' ').trim();
}

export function countryFromChampionship(title: string): string | undefined {
  const normalized = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (normalized.includes('brasileir')) return 'Brasil';
  if (normalized.includes('la liga') || normalized.includes('laliga')) return 'Espanha';
  if (normalized.includes('premier')) return 'Inglaterra';
  if (/\bnba\b|basquete|basket/.test(normalized)) return 'EUA';
  return undefined;
}

export function friendlyName(raw: string): string {
  let text = raw
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
  text = text.replace(/\bsize\s*\d+\s*-\s*\d+\b/gi, ' ');
  text = text.replace(/\bS\s*-\s*\d?X{0,4}L\b/gi, ' ');
  const swaps: [RegExp, string][] = [
    [/third away/gi, 'terceira'],
    [/player version/gi, 'jogador'],
    [/long[- ]sleeved?/gi, 'manga longa'],
    [/windbreaker/gi, 'corta-vento'],
    [/gremio/gi, 'Grêmio'],
    [/women'?s|womens/gi, 'feminina'],
    [/\bkids?\b/gi, 'infantil'],
    [/\bthird\b/gi, 'terceira'],
    [/\baway\b/gi, 'reserva'],
    [/\bhome\b/gi, 'titular'],
    [/\bjersey\b/gi, 'camisa'],
    [/\bretro\b/gi, 'retrô'],
    [/\btraining\b/gi, 'treino'],
    [/\bkit\b/gi, 'conjunto'],
    [/\bvest\b/gi, 'colete'],
    [/\bblack\b/gi, 'preta'],
    [/\bwhite\b/gi, 'branca'],
    [/\bbrown\b/gi, 'marrom'],
  ];
  for (const [pattern, value] of swaps) text = text.replace(pattern, value);
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return raw.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function parseSizeNames(title: string): string[] {
  const kids = title.match(/\bsize\s*(\d{2})\s*-\s*(\d{2})\b/i);
  if (kids) {
    const from = Number(kids[1]);
    const to = Number(kids[2]);
    if (from >= 10 && to <= 40 && from < to) {
      const sizes: string[] = [];
      for (let size = from; size <= to; size += 2) sizes.push(String(size));
      return sizes;
    }
  }
  const adult = title.match(/\bS\s*-\s*(\d)?(X{0,4})L\b/i);
  if (!adult) return [];
  const end = adult[1] ? 2 + Number(adult[1]) : 2 + adult[2].length;
  return ADULT_SIZES.slice(0, Math.min(ADULT_SIZES.length, end + 1));
}

export function sizeSortOrder(name: string): number {
  const fixed: Record<string, number> = {
    PP: 10,
    P: 20,
    M: 30,
    G: 40,
    GG: 50,
    XG: 60,
    '3G': 70,
    '4G': 80,
  };
  if (fixed[name]) return fixed[name];
  const numeric = Number(name);
  if (Number.isInteger(numeric)) return 100 + numeric;
  return 200;
}
