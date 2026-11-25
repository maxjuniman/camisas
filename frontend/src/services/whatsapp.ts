import { storeConfig } from '../config/store';

export function formatPrice(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: storeConfig.currency,
  }).format(value);
}

export function orderMessage(input: { name: string; size?: string }) {
  const message = `Vim pelo site e quero mais informações da camisa ${input.name}`;
  return input.size ? `${message}, tamanho ${input.size}` : message;
}

export function whatsappLink(message: string) {
  return `https://wa.me/${storeConfig.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function contactLink() {
  return whatsappLink('Vim pelo site e quero mais informações');
}
