import { storeConfig } from '../config/store';

export function formatPrice(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: storeConfig.currency,
  }).format(value);
}

export function orderMessage(input: { name: string; price: number; slug: string; size: string }) {
  const link = `${window.location.origin}/produto/${input.slug}`;
  return [
    'Olá! Gostaria de fazer uma encomenda.',
    '',
    `Produto: ${input.name}`,
    `Tamanho: ${input.size}`,
    `Preço: ${formatPrice(input.price)}`,
    `Link do produto: ${link}`,
    '',
    'Gostaria de mais informações sobre disponibilidade e prazo de entrega.',
  ].join('\n');
}

export function whatsappLink(message: string) {
  return `https://wa.me/${storeConfig.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function contactLink() {
  return whatsappLink(`Olá! Vim pelo site ${storeConfig.name} e quero fazer uma encomenda.`);
}
