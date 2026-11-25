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
  const [ready, setReady] = useState(false);
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
  const stock = product.readyToShip ? product.stockSizes : [];
  const link = whatsappLink(orderMessage({ name: product.name, size: size || undefined }));

  function choose(name: string, nextReady: boolean) {
    if (size === name && ready === nextReady) {
      setSize('');
      setReady(false);
      return;
    }
    setSize(name);
    setReady(nextReady);
  }

  return (
    <Wrap>
      <Layout>
        <Gallery>
          {image ? <Main src={image.url} alt={product.name} /> : <Fallback>Sem foto</Fallback>}
          <Thumbs>
            {product.images.map((item, index) => (
              <button key={item.id} type="button" onClick={() => setPhoto(index)}>
                <img src={item.thumbUrl || item.url} alt="" />
              </button>
            ))}
          </Thumbs>
        </Gallery>
        <Info>
          <Head>
            <Eyebrow>{[product.sport?.name, product.country?.name, product.team?.name].filter(Boolean).join(' · ')}</Eyebrow>
            <h1>{product.name}</h1>
            <PriceRow>
              {product.readyToShip ? <Ready>Pronta entrega</Ready> : null}
              <Price>{formatPrice(product.price)}</Price>
            </PriceRow>
          </Head>
          <Facts>
            <div><span>Esporte</span><strong>{product.sport?.name || '—'}</strong></div>
            <div><span>País</span><strong>{product.country?.name || '—'}</strong></div>
            <div><span>Time</span><strong>{product.team?.name || '—'}</strong></div>
            <div><span>Categoria</span><strong>{product.category?.name || '—'}</strong></div>
            <div><span>Sexo</span><strong>{product.gender?.name || '—'}</strong></div>
            <div><span>Temporada</span><strong>{product.season?.name || '—'}</strong></div>
          </Facts>
          {product.description ? <Description>{product.description}</Description> : null}
          <Buy>
            {stock.length ? (
              <div id="pronta">
                <SizeLabel>Pronta entrega</SizeLabel>
                <Sizes>
                  {stock.map((item) => (
                    <Size key={item.id} type="button" $on={ready && size === item.name} onClick={() => choose(item.name, true)}>{item.name}</Size>
                  ))}
                </Sizes>
              </div>
            ) : null}
            {product.sizes.length ? (
              <div id="encomenda">
                <SizeLabel>Encomenda</SizeLabel>
                <Sizes>
                  {product.sizes.map((item) => (
                    <Size key={item.id} type="button" $on={!ready && size === item.name} onClick={() => choose(item.name, false)}>{item.name}</Size>
                  ))}
                </Sizes>
              </div>
            ) : null}
            <Button as="a" href={link} $tone="accent" target="_blank" rel="noreferrer">
              {ready ? 'Reservar pronta entrega via WhatsApp' : 'Fazer encomenda via WhatsApp'}
            </Button>
            <Hint>{size ? 'O tamanho escolhido entra na mensagem.' : 'Se quiser, escolha um tamanho antes de chamar no WhatsApp.'}</Hint>
          </Buy>
          <Notes>
            <Note>
              <strong>Disponibilidade.</strong> {product.availabilityNote || 'A disponibilidade é confirmada no WhatsApp.'}
            </Note>
            <Note>
              <strong>Encomenda.</strong> {product.orderNote || 'Não há pagamento nesta página. O pedido é combinado na conversa.'}
            </Note>
          </Notes>
        </Info>
      </Layout>
    </Wrap>
  );
}

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 460px);
  gap: 56px;
  align-items: start;
  padding: 36px 0 72px;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 28px;
  }
`;
const Gallery = styled.div`
  display: grid;
  gap: 14px;
  align-content: start;
`;
const Main = styled.img`
  width: 100%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  background: ${({ theme }) => theme.inkSoft};
`;
const Fallback = styled.div`
  aspect-ratio: 4 / 5;
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme.ink};
  color: ${({ theme }) => theme.paper};
`;
const Thumbs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  button { border: 0; padding: 0; background: none; cursor: pointer; width: 76px; }
  img { width: 76px; height: 96px; object-fit: cover; }
`;
const Info = styled.div`
  display: grid;
  align-content: start;
  gap: 28px;
  min-width: 0;
`;
const Head = styled.div`
  display: grid;
  gap: 14px;
  h1 {
    margin: 0;
    font-family: ${({ theme }) => theme.display};
    font-size: clamp(36px, 4vw, 52px);
    font-weight: 600;
    line-height: 0.98;
    letter-spacing: 0.01em;
    text-transform: uppercase;
  }
`;
const Eyebrow = styled.p`
  margin: 0;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 12px;
  color: ${({ theme }) => theme.muted};
`;
const PriceRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 18px;
`;
const Ready = styled.p`
  margin: 0;
  width: fit-content;
  background: ${({ theme }) => theme.accent};
  color: ${({ theme }) => theme.accentInk};
  padding: 6px 10px;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
`;
const Price = styled.strong`font-size: 32px; color: ${({ theme }) => theme.ink};`;
const Facts = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px 16px;
  padding: 18px 0;
  border-top: 1px solid ${({ theme }) => theme.line};
  border-bottom: 1px solid ${({ theme }) => theme.line};
  span { display: block; margin-bottom: 4px; color: ${({ theme }) => theme.muted}; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
  strong { font-size: 16px; font-weight: 600; }
  @media (max-width: 520px) { grid-template-columns: 1fr 1fr; }
`;
const Description = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
`;
const Buy = styled.div`
  display: grid;
  gap: 22px;
  a { justify-self: start; padding: 14px 18px; }
`;
const SizeLabel = styled.p`
  margin: 0 0 10px;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
`;
const Sizes = styled.div`display: flex; flex-wrap: wrap; gap: 10px;`;
const Size = styled.button<{ $on: boolean }>`
  min-width: 52px;
  padding: 12px 14px;
  border: 1px solid ${({ theme, $on }) => ($on ? theme.accent : theme.ink)};
  background: ${({ theme, $on }) => ($on ? theme.accent : 'transparent')};
  color: ${({ theme, $on }) => ($on ? theme.accentInk : theme.ink)};
  cursor: pointer;
`;
const Hint = styled.p`margin: 0; color: ${({ theme }) => theme.muted}; font-size: 14px; line-height: 1.4;`;
const Notes = styled.div`
  display: grid;
  gap: 12px;
  padding-top: 8px;
`;
const Note = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: ${({ theme }) => theme.muted};
  strong { color: ${({ theme }) => theme.text}; }
`;
