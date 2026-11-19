const PHRASES: [string, string][] = [
  ['湖人限定飞人', 'Lakers edição limitada Jordan'],
  ['飞人限定', 'edição limitada Jordan'],
  ['灰熊队复古', 'Grizzlies retrô'],
  ['客场蓝色', 'reserva azul'],
  ['复古黑色', 'retrô preta'],
  ['复古白色', 'retrô branca'],
  ['保罗乔治', 'Paul George'],
  ['文班亚马', 'Wembanyama'],
  ['霍姆格伦', 'Holmgren'],
  ['杨翰森', 'Yang Hansen'],
  ['阿弗迪亚', 'Avdija'],
  ['布里奇斯', 'Bridges'],
  ['克拉克森', 'Clarkson'],
  ['卡拉克森', 'Clarkson'],
  ['爱德华兹', 'Edwards'],
  ['英格拉姆', 'Ingram'],
  ['德罗赞', 'DeRozan'],
  ['弗拉格', 'Flagg'],
  ['班凯罗', 'Banchero'],
  ['哈达威', 'Hardaway'],
  ['伦纳德', 'Leonard'],
  ['布伦森', 'Brunson'],
  ['汤普森', 'Thompson'],
  ['罗德曼', 'Rodman'],
  ['开拓者队', 'Trail Blazers'],
  ['凯尔特人', 'Celtics'],
  ['独行侠', 'Mavericks'],
  ['森林狼', 'Timberwolves'],
  ['鹈鹕队', 'Pelicans'],
  ['尼克斯队', 'Knicks'],
  ['雷霆队', 'Thunder'],
  ['骑士队', 'Cavaliers'],
  ['魔术队', 'Magic'],
  ['公牛队', 'Chicago Bulls'],
  ['火箭队', 'Rockets'],
  ['太阳队', 'Suns'],
  ['快船队', 'Clippers'],
  ['马刺队', 'Spurs'],
  ['灰熊队', 'Grizzlies'],
  ['猛龙队', 'Raptors'],
  ['湖人队', 'Lakers'],
  ['爵士队', 'Jazz'],
  ['黄蜂队', 'Hornets'],
  ['热火队', 'Heat'],
  ['雄鹿队', 'Bucks'],
  ['篮网队', 'Nets'],
  ['活塞队', 'Pistons'],
  ['奇才队', 'Wizards'],
  ['老鹰队', 'Hawks'],
  ['国王队', 'Kings'],
  ['步行者', 'Pacers'],
  ['开拓者', 'Trail Blazers'],
  ['尼克斯', 'Knicks'],
  ['黄蜂', 'Hornets'],
  ['猛龙', 'Raptors'],
  ['灰熊', 'Grizzlies'],
  ['马刺', 'Spurs'],
  ['勇士', 'Warriors'],
  ['掘金', 'Nuggets'],
  ['公牛', 'Chicago Bulls'],
  ['火箭', 'Rockets'],
  ['快船', 'Clippers'],
  ['湖人', 'Lakers'],
  ['爵士', 'Jazz'],
  ['热火', 'Heat'],
  ['雄鹿', 'Bucks'],
  ['篮网', 'Nets'],
  ['活塞', 'Pistons'],
  ['奇才', 'Wizards'],
  ['老鹰', 'Hawks'],
  ['国王', 'Kings'],
  ['76人', '76ers'],
  ['城市版', 'versão cidade'],
  ['球员版', 'jogador'],
  ['球迷版', 'torcedor'],
  ['复古黑', 'retrô preta'],
  ['复古白', 'retrô branca'],
  ['复古', 'retrô'],
  ['主场', 'titular'],
  ['客场', 'reserva'],
  ['球衣', 'camisa'],
  ['长袖', 'manga longa'],
  ['短袖', 'manga curta'],
  ['训练', 'treino'],
  ['女款', 'feminina'],
  ['童装', 'infantil'],
  ['限定', 'edição limitada'],
  ['飞人', 'Jordan'],
  ['紫色', 'roxa'],
  ['白色', 'branca'],
  ['黑色', 'preta'],
  ['绿色', 'verde'],
  ['灰色', 'cinza'],
  ['蓝色', 'azul'],
  ['红色', 'vermelha'],
  ['黄色', 'amarela'],
  ['粉色', 'rosa'],
  ['橙色', 'laranja'],
  ['金色', 'dourada'],
  ['棕色', 'marrom'],
  ['莫兰特', 'Morant'],
  ['塔图姆', 'Tatum'],
  ['威廉姆斯', 'Williams'],
  ['亚历山大', 'Alexander'],
  ['艾佛森', 'Iverson'],
  ['东契奇', 'Doncic'],
  ['巴特勒', 'Butler'],
  ['杜兰特', 'Durant'],
  ['里弗斯', 'Rivers'],
  ['拉塞尔', 'Russell'],
  ['戴维斯', 'Davis'],
  ['恩比德', 'Embiid'],
  ['米切尔', 'Mitchell'],
  ['布朗尼', 'Bronny'],
  ['詹姆斯', 'James'],
  ['哈登', 'Harden'],
  ['欧文', 'Irving'],
  ['库里', 'Curry'],
  ['马克西', 'Maxey'],
  ['格林', 'Green'],
  ['加兰', 'Garland'],
  ['乔治', 'George'],
  ['卡特', 'Carter'],
  ['麦迪', 'McGrady'],
  ['乔丹', 'Jordan'],
  ['奥尼尔', "O'Neal"],
  ['科比', 'Kobe'],
  ['威少', 'Westbrook'],
  ['布朗', 'Brown'],
  ['瓦格纳', 'Wagner'],
  ['利拉德', 'Lillard'],
  ['索汗', 'Sochan'],
  ['福克斯', 'Fox'],
  ['鲍尔', 'Ball'],
  ['唐斯', 'Towns'],
  ['普尔', 'Poole'],
  ['拉文', 'LaVine'],
  ['皮蓬', 'Pippen'],
  ['罗斯', 'Rose'],
  ['申京', 'Sengun'],
  ['布克', 'Booker'],
  ['凯塔', 'Keita'],
  ['白', 'branca'],
  ['黑', 'preta'],
];

const TEAMS: [string, string][] = PHRASES.filter(([, value]) =>
  /^(Lakers|Jazz|Celtics|Hornets|Trail Blazers|76ers|Knicks|Thunder|Cavaliers|Mavericks|Raptors|Grizzlies|Spurs|Warriors|Nuggets|Magic|Chicago Bulls|Rockets|Suns|Clippers|Pelicans|Timberwolves|Heat|Bucks|Nets|Pistons|Wizards|Hawks|Kings|Pacers)$/.test(value),
);

const orderedPhrases = [...PHRASES].sort((a, b) => b[0].length - a[0].length);
const orderedTeams = [...TEAMS].sort((a, b) => b[0].length - a[0].length);

export function hasChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

export function seasonLabel(title: string): string | undefined {
  const full = title.match(/\b(20\d{2})\/(\d{2})\b/);
  if (full) return `${full[1]}/${full[2]}`;
  const slash = title.match(/\b(\d{2})\/(\d{2})\b/);
  if (slash) return `20${slash[1]}/${slash[2]}`;
  const season = title.match(/(\d{2})\s*赛季/);
  const bare = !season && hasChinese(title) ? title.match(/(?:^|\s)(\d{2})(?=\s)/) : null;
  const year = season?.[1] || bare?.[1];
  if (!year) return undefined;
  const end = 2000 + Number(year);
  if (end < 1990 || end > 2100) return undefined;
  return `${end - 1}/${year}`;
}

export function captionTeam(raw: string): { name: string; country: string; sport: string } | null {
  if (!hasChinese(raw)) return null;
  const found = orderedTeams.find(([from]) => raw.includes(from));
  if (!found) return null;
  return { name: found[1], country: 'EUA', sport: 'basquete' };
}

export function translateCaption(raw: string): string {
  let text = raw.replace(/\s+/g, ' ').trim();
  const season = seasonLabel(text);
  if (season) text = text.replace(/(\d{2})\s*赛季/g, ' ').replace(/(?:^|\s)(\d{2})(?=\s)/, ' ');
  for (const [from, to] of orderedPhrases) {
    if (text.includes(from)) text = text.split(from).join(` ${to} `);
  }
  text = text.replace(/(\d+)\s*号/g, ' nº $1 ');
  text = `${season ? `${season} ` : ''}${text}`.replace(/\s+/g, ' ').trim();
  return text;
}
