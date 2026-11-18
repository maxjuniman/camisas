import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { Button, Input, Notice, Select } from '../../components/ui';
import { api } from '../../services/api';
import { formatPrice } from '../../services/whatsapp';
import { Product, RefItem, statusLabel } from '../../types';

type Page = { items: Product[]; total: number; page: number };

export function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [teams, setTeams] = useState<RefItem[]>([]);
  const [sports, setSports] = useState<RefItem[]>([]);
  const [categories, setCategories] = useState<RefItem[]>([]);
  const [q, setQ] = useState('');
  const [teamId, setTeamId] = useState('');
  const [sportId, setSportId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const { data } = await api.get<Page>('/admin/products', { params: { q, teamId, sportId, categoryId, status } });
    setItems(data.items);
  }

  useEffect(() => {
    Promise.all([
      api.get<RefItem[]>('/admin/taxonomies/teams'),
      api.get<RefItem[]>('/admin/taxonomies/sports'),
      api.get<RefItem[]>('/admin/taxonomies/categories'),
      load(),
    ]).then(([teamRes, sportRes, categoryRes]) => {
      setTeams(teamRes.data);
      setSports(sportRes.data);
      setCategories(categoryRes.data);
    }).catch((reason: Error) => setError(reason.message));
    // eslint isn't configured; load uses current filters on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(product: Product) {
    await api.patch(`/admin/products/${product.id}/flags`, { isActive: !product.isActive });
    await load();
  }

  async function remove(product: Product) {
    if (!window.confirm(`Excluir ${product.name}?`)) return;
    await api.delete(`/admin/products/${product.id}`);
    setMessage('Produto excluído.');
    await load();
  }

  return (
    <section>
      <Head>
        <h1>Produtos</h1>
        <Button as={Link} to="/admin/produtos/novo">Novo produto</Button>
      </Head>
      <Filters onSubmit={(event) => { event.preventDefault(); void load().catch((reason: Error) => setError(reason.message)); }}>
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Pesquisar" />
        <Select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">Time</option>{teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={sportId} onChange={(event) => setSportId(event.target.value)}><option value="">Esporte</option>{sports.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Categoria</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Status</option>
          <option value="APPROVED">Aprovado</option>
          <option value="PENDING">Pendente</option>
          <option value="DRAFT">Rascunho</option>
          <option value="IGNORED">Ignorado</option>
        </Select>
        <Button type="submit" $tone="ink">Filtrar</Button>
      </Filters>
      {message ? <Notice $kind="ok">{message}</Notice> : null}
      {error ? <Notice $kind="error">{error}</Notice> : null}
      <Table>
        <thead><tr><th>Produto</th><th>Preço</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {items.map((product) => (
            <tr key={product.id}>
              <td>{product.name}<small>{[product.sport?.name, product.country?.name, product.team?.name].filter(Boolean).join(' · ')}</small></td>
              <td>{formatPrice(product.price)}</td>
              <td>{statusLabel[product.status]} · {product.isActive ? 'Ativo' : 'Inativo'}</td>
              <td>
                <Link to={`/admin/produtos/${product.id}`}>Editar</Link>
                <button type="button" onClick={() => void toggle(product)}>{product.isActive ? 'Desativar' : 'Ativar'}</button>
                <button type="button" onClick={() => void remove(product)}>Excluir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}

const Head = styled.div`display: flex; justify-content: space-between; align-items: center; h1 { font-family: ${({ theme }) => theme.display}; font-size: 48px; text-transform: uppercase; }`;
const Filters = styled.form`display: grid; grid-template-columns: 1.4fr repeat(4, 1fr) auto; gap: 8px; @media (max-width: 900px) { grid-template-columns: 1fr; }`;
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: ${({ theme }) => theme.paperRaised};
  th, td { text-align: left; padding: 10px; border-bottom: 1px solid ${({ theme }) => theme.line}; vertical-align: top; }
  small { display: block; color: ${({ theme }) => theme.muted}; }
  button, a { margin-right: 8px; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; }
`;
