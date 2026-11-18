import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { ProductCard } from '../components/ProductCard';
import { Grid, SectionTitle, Wrap } from '../components/ui';
import { storeConfig } from '../config/store';
import { api } from '../services/api';
import { Product, RefItem } from '../types';

type HomeData = {
  featured: Product[];
  launches: Product[];
  recent: Product[];
  sports: (RefItem & { count: number })[];
  teams: (RefItem & { count: number })[];
};

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = storeConfig.name;
    api.get<HomeData>('/home').then((response) => setData(response.data)).catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <main>
      <Hero>
        <Wrap>
          <HeroGrid>
            <div>
              <Eyebrow>Encomenda direta</Eyebrow>
              <h1>A camisa do jogo, pronta para sair do vestiário.</h1>
              <p>Escolha o modelo e o tamanho. O pedido segue pelo WhatsApp, com prazo confirmado na conversa.</p>
              <HeroLink to="/catalogo">Ver catálogo</HeroLink>
            </div>
            <Jersey aria-hidden="true">
              <svg viewBox="0 0 240 280">
                <path d="M40 48 78 28h84l38 20-22 36v150H62V84Z" fill="#F3EEE6" />
                <path d="M108 28h24l14 34H94Z" fill="#121418" />
                <path d="M62 92h116v18H62Z" fill="#D83A2C" />
              </svg>
            </Jersey>
          </HeroGrid>
        </Wrap>
      </Hero>
      <Wrap>
        {error ? <p>{error}</p> : null}
        <Block>
          <SectionTitle>Destaques</SectionTitle>
          {data && data.featured.length === 0 ? <Quiet>Nenhum destaque publicado ainda.</Quiet> : null}
          <Grid>{data?.featured.map((product) => <ProductCard key={product.id} product={product} />)}</Grid>
        </Block>
        <Block>
          <SectionTitle>Lançamentos</SectionTitle>
          {data && data.launches.length === 0 ? <Quiet>Os lançamentos aparecem aqui quando forem marcados no painel.</Quiet> : null}
          <Grid>{data?.launches.map((product) => <ProductCard key={product.id} product={product} />)}</Grid>
        </Block>
        <Block>
          <SectionTitle>Por esporte</SectionTitle>
          <SportList>
            {(data?.sports.length ? data.sports : [{ id: 'futebol', name: 'Futebol', slug: 'futebol', count: 0 }, { id: 'basquete', name: 'Basquete', slug: 'basquete', count: 0 }]).map((sport) => (
              <SportLink key={sport.id} to={`/catalogo?sports=${sport.slug}`}>
                <span>{sport.name}</span>
                <small>{sport.count}</small>
              </SportLink>
            ))}
          </SportList>
        </Block>
        <Block>
          <SectionTitle>Por time</SectionTitle>
          <TeamRow>
            {data?.teams.length ? data.teams.map((team) => (
              <Link key={team.id} to={`/catalogo?teams=${team.slug}`}>{team.name}</Link>
            )) : <Quiet>Os times com camisas publicadas entram nesta lista.</Quiet>}
          </TeamRow>
        </Block>
        <Block>
          <SectionTitle>Recém-adicionados</SectionTitle>
          {data && data.recent.length === 0 ? <Quiet>O catálogo ainda está vazio.</Quiet> : null}
          <Grid>{data?.recent.map((product) => <ProductCard key={product.id} product={product} />)}</Grid>
        </Block>
      </Wrap>
    </main>
  );
}

function Quiet({ children }: { children: string }) {
  return <EmptyNote>{children}</EmptyNote>;
}

const Hero = styled.section`
  background: ${({ theme }) => theme.ink};
  color: ${({ theme }) => theme.paper};
  padding: 64px 0 48px;
  h1 {
    font-family: ${({ theme }) => theme.display};
    font-size: clamp(52px, 8vw, 92px);
    line-height: 0.88;
    text-transform: uppercase;
    max-width: 740px;
    margin: 12px 0 16px;
  }
  p { max-width: 460px; color: #d9d0c4; }
`;
const HeroGrid = styled.div`
  display: grid;
  grid-template-columns: 1.4fr 0.6fr;
  gap: 24px;
  align-items: end;
  @media (max-width: 800px) { grid-template-columns: 1fr; }
`;
const Eyebrow = styled.p`
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 12px;
  color: ${({ theme }) => theme.accent};
`;
const HeroLink = styled(Link)`
  display: inline-block;
  margin-top: 22px;
  background: ${({ theme }) => theme.accent};
  color: ${({ theme }) => theme.accentInk};
  padding: 12px 16px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 13px;
`;
const Jersey = styled.div`
  svg { width: min(280px, 100%); }
  @media (max-width: 800px) { display: none; }
`;
const Block = styled.section`margin-top: 56px; display: grid; gap: 18px;`;
const EmptyNote = styled.p`color: ${({ theme }) => theme.muted};`;
const SportList = styled.div`display: grid;`;
const SportLink = styled(Link)`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-top: 1px solid ${({ theme }) => theme.line};
  padding: 14px 0;
  font-family: ${({ theme }) => theme.display};
  font-size: 40px;
  text-transform: uppercase;
  &:hover { color: ${({ theme }) => theme.accent}; }
  small { font-family: ${({ theme }) => theme.body}; font-size: 14px; color: ${({ theme }) => theme.muted}; }
`;
const TeamRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  a { border-bottom: 1px solid ${({ theme }) => theme.ink}; text-transform: uppercase; letter-spacing: 0.06em; font-size: 14px; }
`;
