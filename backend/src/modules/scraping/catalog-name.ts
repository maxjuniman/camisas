import { hasChinese, translateCaption } from './caption-pt';

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

const COUNTRIES: Record<string, string> = {
  brazil: 'Brasil',
  brasil: 'Brasil',
  england: 'Inglaterra',
  spain: 'Espanha',
  espana: 'Espanha',
  germany: 'Alemanha',
  france: 'França',
  italy: 'Itália',
  italia: 'Itália',
  netherlands: 'Holanda',
  holland: 'Holanda',
  'united states': 'EUA',
  usa: 'EUA',
  mexico: 'México',
  japan: 'Japão',
  argentina: 'Argentina',
  portugal: 'Portugal',
  uruguay: 'Uruguai',
  belgium: 'Bélgica',
  croatia: 'Croácia',
  switzerland: 'Suíça',
  sweden: 'Suécia',
  norway: 'Noruega',
  denmark: 'Dinamarca',
  poland: 'Polônia',
  scotland: 'Escócia',
  wales: 'País de Gales',
  ireland: 'Irlanda',
  'south korea': 'Coreia do Sul',
  korea: 'Coreia do Sul',
  australia: 'Austrália',
  canada: 'Canadá',
  morocco: 'Marrocos',
  senegal: 'Senegal',
  cameroon: 'Camarões',
  nigeria: 'Nigéria',
  ghana: 'Gana',
  ecuador: 'Equador',
  colombia: 'Colômbia',
  chile: 'Chile',
  peru: 'Peru',
  paraguay: 'Paraguai',
  'costa rica': 'Costa Rica',
  'saudi arabia': 'Arábia Saudita',
  turkey: 'Turquia',
  greece: 'Grécia',
  czechia: 'Tchéquia',
  'czech republic': 'Tchéquia',
  austria: 'Áustria',
  hungary: 'Hungria',
  serbia: 'Sérvia',
  ukraine: 'Ucrânia',
  russia: 'Rússia',
  china: 'China',
  'south africa': 'África do Sul',
  egypt: 'Egito',
  tunisia: 'Tunísia',
  algeria: 'Argélia',
  iran: 'Irã',
  qatar: 'Catar',
  'united arab emirates': 'Emirados Árabes',
  'ivory coast': 'Costa do Marfim',
  jamaica: 'Jamaica',
};

function fold(value: string) {
  return value
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function portugueseCountry(raw: string): string {
  const key = fold(raw);
  return COUNTRIES[key] || raw.replace(/\s+/g, ' ').trim();
}

export function nationalTeamFromTitle(title: string): string | undefined {
  const plain = title.replace(/\p{Extended_Pictographic}/gu, ' ').replace(/\s+/g, ' ').trim();
  const normalized = fold(plain);
  const marked = normalized.includes('team column') || /\bnational teams?\b/.test(normalized) || /\bselecao\b|\bseleccion\b/.test(normalized);
  if (!marked) return undefined;
  const country = fold(plain)
    .replace(/\bteam columns?\b/g, ' ')
    .replace(/\bnational teams?\b/g, ' ')
    .replace(/\bselecao\b|\bseleccion\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!country) return undefined;
  return portugueseCountry(country);
}

export function isNationalGroup(title: string): boolean {
  const normalized = fold(title);
  return (/\bnational teams?\b/.test(normalized) || /\bselecoes\b/.test(normalized)) && !nationalTeamFromTitle(title);
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
  if (hasChinese(text)) text = translateCaption(text);
  text = text.replace(/\bsize\s*\d+\s*-\s*\d+\b/gi, ' ');
  text = text.replace(/\bS\s*-\s*\d?X{0,4}L\b/gi, ' ');
  const swaps: [RegExp, string][] = [
    [/third away/gi, 'terceira'],
    [/player version/gi, 'jogador'],
    [/long[- ]sleeved?/gi, 'manga longa'],
    [/windbreaker/gi, 'corta-vento'],
    [/gremio/gi, 'Grêmio'],
    [/\bbrazil\b/gi, 'Brasil'],
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
