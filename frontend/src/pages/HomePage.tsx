import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import logo from '../img/logo.jpeg';
import { ProductCard } from '../components/ProductCard';
import { Grid, SectionTitle, Wrap } from '../components/ui';
import { storeConfig } from '../config/store';
import { api } from '../services/api';
import { Product } from '../types';

type Division = {
  id: string;
  name: string;
  slug: string;
  countries: {
    id: string;
    name: string;
    slug: string;
    teams: { id: string; name: string; slug: string }[];
  }[];
};

type HomeData = {
  ready: Product[];
  featured: Product[];
  launches: Product[];
  recent: Product[];
  divisions: Division[];
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
              <Eyebrow>Futebol · NBA · NFL</Eyebrow>
              <h1>A camisa do jogo, pronta para sair do vestiário.</h1>
              <p>Escolha o modelo e o tamanho. O pedido segue pelo WhatsApp, com prazo confirmado na conversa.</p>
              <HeroLink to="/catalogo">Ver catálogo</HeroLink>
            </div>
            <Mark>
              <img src={logo} alt={storeConfig.name} />
            </Mark>
          </HeroGrid>
        </Wrap>
      </Hero>
      <Wrap>
        {error ? <p>{error}</p> : null}
        <Block>
          <SectionHead>
            <SectionTitle>Pronta entrega</SectionTitle>
            <More to="/catalogo?ready=1">Ver todas</More>
          </SectionHead>
          {data && data.ready.length === 0 ? <Quiet>As peças em pronta entrega aparecem aqui quando forem marcadas no painel.</Quiet> : null}
          <Grid>{data?.ready.map((product) => <ProductCard key={product.id} product={product} />)}</Grid>
        </Block>
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
          <SectionTitle>Esporte, país e time</SectionTitle>
          {data && data.divisions.every((sport) => sport.countries.length === 0) ? <Quiet>Os times aparecem aqui quando tiverem esporte e país.</Quiet> : null}
          <DivisionList>
            {data?.divisions.filter((sport) => sport.countries.length).map((sport) => (
              <div key={sport.id}>
                <SportLink to={`/catalogo?sports=${sport.slug}`}>{sport.name}</SportLink>
                {sport.countries.map((country) => (
                  <Country key={country.id}>
                    <Link to={`/catalogo?sports=${sport.slug}&countries=${country.slug}`}>{country.name}</Link>
                    <TeamRow>
                      {country.teams.map((team) => (
                        <Link key={team.id} to={`/catalogo?sports=${sport.slug}&countries=${country.slug}&teams=${team.slug}`}>{team.name}</Link>
                      ))}
                    </TeamRow>
                  </Country>
                ))}
              </div>
            ))}
          </DivisionList>
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
  p { max-width: 460px; color: #D6DEE8; }
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
const Mark = styled.div`
  justify-self: end;
  background: ${({ theme }) => theme.white};
  padding: 12px;
  img { width: min(280px, 100%); display: block; }
  @media (max-width: 800px) { display: none; }
`;
const Block = styled.section`margin-top: 56px; display: grid; gap: 18px;`;
const SectionHead = styled.div`display: flex; align-items: end; justify-content: space-between; gap: 16px;`;
const More = styled(Link)`
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 13px;
  border-bottom: 1px solid ${({ theme }) => theme.ink};
  padding-bottom: 2px;
`;
const EmptyNote = styled.p`color: ${({ theme }) => theme.muted};`;
const DivisionList = styled.div`display: grid; gap: 28px;`;
const SportLink = styled(Link)`
  display: block;
  border-top: 1px solid ${({ theme }) => theme.line};
  padding: 14px 0 8px;
  font-family: ${({ theme }) => theme.display};
  font-size: 40px;
  text-transform: uppercase;
  &:hover { color: ${({ theme }) => theme.accent}; }
`;
const Country = styled.div`
  display: grid;
  gap: 8px;
  padding: 8px 0 8px 12px;
  > a { font-size: 18px; text-transform: uppercase; letter-spacing: 0.08em; }
`;
const TeamRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  a { border-bottom: 1px solid ${({ theme }) => theme.ink}; text-transform: uppercase; letter-spacing: 0.06em; font-size: 14px; }
`;
