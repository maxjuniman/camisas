import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { Button, Wrap } from '../components/ui';
import { storeConfig } from '../config/store';
import { api } from '../services/api';
import { formatPrice, orderMessage, whatsappLink } from '../services/whatsapp';
import { Product } from '../types';

export function ProductPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [size, setSize] = useState('');
  const [photo, setPhoto] = useState(0);

  useEffect(() => {
    if (!slug) return;
    api
      .get<Product>(`/products/${slug}`)
      .then((response) => {
        setProduct(response.data);
        document.title = `${response.data.name} · ${storeConfig.name}`;
      })
      .catch((reason: Error) => setError(reason.message));
  }, [slug]);

  if (error) return <Wrap><p>{error}</p></Wrap>;
  if (!product) return <Wrap><p>Carregando...</p></Wrap>;

  const image = product.images[photo] ?? product.images[0];
  const link = size
    ? whatsappLink(orderMessage({ name: product.name, price: product.price, slug: product.slug, size }))
    : undefined;

  return (
    <Wrap>
      <Layout>
        <Gallery>
          {image ? <img src={image.url} alt={product.name} /> : <Fallback>Sem foto</Fallback>}
          <Thumbs>
            {product.images.map((item, index) => (
              <button key={item.id} type="button" onClick={() => setPhoto(index)}>
                <img src={item.thumbUrl || item.url} alt="" />
              </button>
            ))}
          </Thumbs>
        </Gallery>
        <Info id="encomenda">
          <p>{[product.team?.name, product.season?.name].filter(Boolean).join(' · ')}</p>
          <h1>{product.name}</h1>
          <Price>{formatPrice(product.price)}</Price>
          <Facts>
            <div><span>Esporte</span><strong>{product.sport?.name || '—'}</strong></div>
            <div><span>Categoria</span><strong>{product.category?.name || '—'}</strong></div>
            <div><span>Sexo</span><strong>{product.gender?.name || '—'}</strong></div>
            <div><span>Temporada</span><strong>{product.season?.name || '—'}</strong></div>
          </Facts>
          <p>{product.description}</p>
          <SizeLabel>Tamanho</SizeLabel>
          <Sizes>
            {product.sizes.map((item) => (
              <Size key={item.id} type="button" $on={size === item.name} onClick={() => setSize(item.name)}>{item.name}</Size>
            ))}
          </Sizes>
          <Button as="a" href={link || undefined} aria-disabled={!size} $tone="accent" target="_blank" rel="noreferrer" onClick={(event) => { if (!size) event.preventDefault(); }}>
            Fazer encomenda via WhatsApp
          </Button>
          {!size ? <Hint>Selecione um tamanho para encomendar.</Hint> : null}
          <Note>
            <strong>Disponibilidade.</strong> {product.availabilityNote || 'A disponibilidade é confirmada no WhatsApp.'}
          </Note>
          <Note>
            <strong>Encomenda.</strong> {product.orderNote || 'Não há pagamento nesta página. O pedido é combinado na conversa.'}
          </Note>
        </Info>
      </Layout>
    </Wrap>
  );
}

const Layout = styled.div`
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 36px;
  padding: 28px 0;
  @media (max-width: 860px) { grid-template-columns: 1fr; }
`;
const Gallery = styled.div`display: grid; gap: 10px; align-content: start;`;
const Fallback = styled.div`
  aspect-ratio: 4 / 5;
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme.ink};
  color: ${({ theme }) => theme.paper};
`;
const Thumbs = styled.div`
  display: flex;
  gap: 8px;
  button { border: 0; padding: 0; background: none; cursor: pointer; width: 72px; }
  img { width: 72px; height: 88px; object-fit: cover; }
`;
const Info = styled.div`
  display: grid;
  align-content: start;
  gap: 12px;
  h1 { font-family: ${({ theme }) => theme.display}; font-size: clamp(42px, 6vw, 68px); line-height: 0.9; text-transform: uppercase; }
  > p:first-child { letter-spacing: 0.12em; text-transform: uppercase; font-size: 12px; color: ${({ theme }) => theme.muted}; }
`;
const Price = styled.strong`font-size: 28px; color: ${({ theme }) => theme.accent};`;
const Facts = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  span { display: block; color: ${({ theme }) => theme.muted}; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
`;
const SizeLabel = styled.p`font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;`;
const Sizes = styled.div`display: flex; flex-wrap: wrap; gap: 8px;`;
const Size = styled.button<{ $on: boolean }>`
  min-width: 48px;
  padding: 10px 12px;
  border: 1px solid ${({ theme, $on }) => ($on ? theme.accent : theme.ink)};
  background: ${({ theme, $on }) => ($on ? theme.accent : 'transparent')};
  color: ${({ theme, $on }) => ($on ? theme.accentInk : theme.ink)};
  cursor: pointer;
`;
const Hint = styled.p`color: ${({ theme }) => theme.muted}; font-size: 14px;`;
const Note = styled.p`font-size: 14px; color: ${({ theme }) => theme.muted}; strong { color: ${({ theme }) => theme.text}; }`;
