import { useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { formatPrice, orderMessage, whatsappLink } from '../services/whatsapp';
import { Product, coverOf } from '../types';

export function ProductCard({ product }: { product: Product }) {
  const [size, setSize] = useState('');
  const cover = coverOf(product);
  const hover = product.images.find((image) => image.id !== cover?.id);
  const href = size
    ? whatsappLink(orderMessage({ name: product.name, price: product.price, slug: product.slug, size }))
    : `/produto/${product.slug}#encomenda`;

  return (
    <Card>
      <Photo to={`/produto/${product.slug}`}>
        {cover ? <img src={cover.thumbUrl || cover.url} alt={product.name} /> : <Empty>Sem foto</Empty>}
        {hover ? <img className="alt" src={hover.thumbUrl || hover.url} alt="" /> : null}
        <Marks>
          {product.isLaunch ? <span>Lançamento</span> : null}
          {product.isFeatured ? <span>Destaque</span> : null}
        </Marks>
      </Photo>
      <Meta>
        <Team>{product.team?.name || product.sport?.name || 'Esporte'}</Team>
        <Name to={`/produto/${product.slug}`}>{product.name}</Name>
        <Line>{[product.sport?.name, product.gender?.name].filter(Boolean).join(' · ')}</Line>
        <Price>{formatPrice(product.price)}</Price>
        <Sizes>
          {product.sizes.map((item) => (
            <SizeButton
              key={item.id}
              type="button"
              $on={size === item.name}
              onClick={() => setSize((current) => (current === item.name ? '' : item.name))}
            >
              {item.name}
            </SizeButton>
          ))}
        </Sizes>
        <Order href={href} target={size ? '_blank' : undefined} rel={size ? 'noreferrer' : undefined}>
          Fazer encomenda via WhatsApp
        </Order>
      </Meta>
    </Card>
  );
}

const Card = styled.article`
  display: grid;
  gap: 12px;
`;

const Photo = styled(Link)`
  position: relative;
  aspect-ratio: 4 / 5;
  background: ${({ theme }) => theme.inkSoft};
  overflow: hidden;
  img { width: 100%; height: 100%; object-fit: cover; transition: opacity 0.25s ease; }
  .alt { position: absolute; inset: 0; opacity: 0; }
  &:hover .alt { opacity: 1; }
`;

const Empty = styled.div`
  height: 100%;
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.paper};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 12px;
`;

const Marks = styled.div`
  position: absolute;
  left: 10px;
  top: 10px;
  display: flex;
  gap: 6px;
  span {
    background: ${({ theme }) => theme.paperRaised};
    padding: 4px 6px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
`;

const Meta = styled.div`display: grid; gap: 4px;`;
const Team = styled.p`
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.muted};
`;
const Name = styled(Link)`
  font-family: ${({ theme }) => theme.display};
  font-size: 26px;
  line-height: 1;
  text-transform: uppercase;
`;
const Line = styled.p`color: ${({ theme }) => theme.muted}; font-size: 14px;`;
const Price = styled.strong`color: ${({ theme }) => theme.accent}; font-size: 18px;`;
const Sizes = styled.div`display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;`;
const SizeButton = styled.button<{ $on: boolean }>`
  border: 1px solid ${({ theme, $on }) => ($on ? theme.accent : theme.line)};
  background: ${({ theme, $on }) => ($on ? theme.accent : 'transparent')};
  color: ${({ theme, $on }) => ($on ? theme.accentInk : theme.text)};
  min-width: 36px;
  padding: 4px 6px;
  cursor: pointer;
`;
const Order = styled.a`
  margin-top: 8px;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-bottom: 1px solid ${({ theme }) => theme.ink};
  width: fit-content;
  padding-bottom: 2px;
`;
