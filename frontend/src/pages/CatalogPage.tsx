import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { ProductCard } from '../components/ProductCard';
import { Button, Grid, Input, Select, Wrap } from '../components/ui';
import { storeConfig } from '../config/store';
import { api } from '../services/api';
import { Product, RefItem } from '../types';

type Filters = {
  teams: RefItem[];
  sports: RefItem[];
  countries: RefItem[];
  genders: RefItem[];
  categories: RefItem[];
  sizes: RefItem[];
  price: { min: number; max: number };
};

type Page = { items: Product[]; total: number; page: number; pageSize: number };

const groups = [
  ['sports', 'Esporte'],
  ['countries', 'País'],
  ['teams', 'Time'],
  ['sizes', 'Tamanho'],
  ['genders', 'Sexo'],
  ['categories', 'Categoria'],
] as const;

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [minPrice, setMinPrice] = useState(params.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') || '');

  useEffect(() => {
    document.title = `Catálogo · ${storeConfig.name}`;
    api.get<Filters>('/filters').then((response) => setFilters(response.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .get<Page>('/products', { params: Object.fromEntries(params.entries()) })
      .then((response) => setPage(response.data))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [params]);

  function toggle(key: string, slug: string) {
    const current = (params.get(key) || '').split(',').filter(Boolean);
    const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
    const copy = new URLSearchParams(params);
    if (next.length) copy.set(key, next.join(','));
    else copy.delete(key);
    copy.delete('page');
    setParams(copy);
  }

  function setSort(sort: string) {
    const copy = new URLSearchParams(params);
    copy.set('sort', sort);
    copy.delete('page');
    setParams(copy);
  }

  function applyPrice() {
    const copy = new URLSearchParams(params);
    if (minPrice) copy.set('minPrice', minPrice);
    else copy.delete('minPrice');
    if (maxPrice) copy.set('maxPrice', maxPrice);
    else copy.delete('maxPrice');
    copy.delete('page');
    setParams(copy);
  }

  function go(next: number) {
    const copy = new URLSearchParams(params);
    copy.set('page', String(next));
    setParams(copy);
  }

  const pages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;

  return (
    <Wrap>
      <Layout>
        <Aside>
          <h1>Catálogo</h1>
          {groups.map(([key, label]) => (
            <Group key={key}>
              <strong>{label}</strong>
              {(filters?.[key] ?? []).map((item) => {
                const selected = (params.get(key) || '').split(',').includes(item.slug);
                return (
                  <label key={item.id}>
                    <input type="checkbox" checked={selected} onChange={() => toggle(key, item.slug)} />
                    {item.name}
                  </label>
                );
              })}
            </Group>
          ))}
          <Group>
            <strong>Preço</strong>
            <Input value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Mínimo" inputMode="decimal" />
            <Input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Máximo" inputMode="decimal" />
            <Button type="button" $tone="ink" onClick={applyPrice}>Aplicar preço</Button>
          </Group>
        </Aside>
        <section>
          <Toolbar>
            <p>{loading ? 'Carregando...' : `${page?.total ?? 0} produtos`}</p>
            <Select value={params.get('sort') || 'newest'} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar">
              <option value="newest">Mais recentes</option>
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
              <option value="name">Nome do produto</option>
            </Select>
          </Toolbar>
          {error ? <p>{error}</p> : null}
          {!loading && page?.items.length === 0 ? <p>Nenhum produto encontrado com esses filtros.</p> : null}
          <Grid>{page?.items.map((product) => <ProductCard key={product.id} product={product} />)}</Grid>
          <Pager>
            <Button type="button" $tone="ghost" disabled={(page?.page ?? 1) <= 1} onClick={() => go((page?.page ?? 1) - 1)}>Anterior</Button>
            <span>{page?.page ?? 1} / {pages}</span>
            <Button type="button" $tone="ghost" disabled={(page?.page ?? 1) >= pages} onClick={() => go((page?.page ?? 1) + 1)}>Próxima</Button>
          </Pager>
        </section>
      </Layout>
    </Wrap>
  );
}

const Layout = styled.div`
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 28px;
  padding: 28px 0 12px;
  @media (max-width: 860px) { grid-template-columns: 1fr; }
`;
const Aside = styled.aside`
  display: grid;
  align-content: start;
  gap: 18px;
  h1 { font-family: ${({ theme }) => theme.display}; font-size: 48px; text-transform: uppercase; line-height: 0.9; }
`;
const Group = styled.div`
  display: grid;
  gap: 8px;
  strong { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
  label { display: flex; gap: 8px; align-items: center; font-size: 14px; }
`;
const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
  select { width: 200px; }
`;
const Pager = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 28px;
`;
