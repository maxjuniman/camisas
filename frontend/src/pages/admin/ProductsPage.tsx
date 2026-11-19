import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useDialog } from '../../components/dialog';
import { Button, Input, Notice, Select } from '../../components/ui';
import { api } from '../../services/api';
import { formatPrice } from '../../services/whatsapp';
import { Product, RefItem, coverOf, statusLabel } from '../../types';

type Page = { items: Product[]; total: number; page: number; pageSize: number };

export function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [teams, setTeams] = useState<RefItem[]>([]);
  const [sports, setSports] = useState<RefItem[]>([]);
  const [countries, setCountries] = useState<RefItem[]>([]);
  const [categories, setCategories] = useState<RefItem[]>([]);
  const [q, setQ] = useState('');
  const [teamId, setTeamId] = useState('');
  const [selectionId, setSelectionId] = useState('');
  const [sportId, setSportId] = useState('');
  const [countryId, setCountryId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dialog = useDialog();

  async function load() {
    const params = Object.fromEntries(
      Object.entries({
        q,
        teamId: selectionId && selectionId !== '*' ? selectionId : teamId,
        sportId,
        countryId,
        categoryId,
        status,
        national: selectionId === '*' ? 'true' : '',
      }).filter(([, value]) => value.trim()),
    );
    const { data } = await api.get<Page>('/admin/products', { params });
    setItems(data.items);
    setTotal(data.total);
  }

  useEffect(() => {
    Promise.all([
      api.get<RefItem[]>('/admin/taxonomies/teams'),
      api.get<RefItem[]>('/admin/taxonomies/sports'),
      api.get<RefItem[]>('/admin/taxonomies/countries'),
      api.get<RefItem[]>('/admin/taxonomies/categories'),
      load(),
    ]).then(([teamRes, sportRes, countryRes, categoryRes]) => {
      setTeams(teamRes.data);
      setSports(sportRes.data);
      setCountries(countryRes.data);
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
    if (!(await dialog.confirm(`Excluir ${product.name}?`))) return;
    await api.delete(`/admin/products/${product.id}`);
    setMessage('Produto excluído.');
    await load();
  }

  const visibleCountries = sportId
    ? countries.filter((country) => teams.some((team) => team.sportId === sportId && team.countryId === country.id))
    : countries;
  const matchesScope = (team: RefItem) => (!sportId || team.sportId === sportId) && (!countryId || team.countryId === countryId);
  const visibleTeams = teams.filter((team) => !team.isNational && matchesScope(team));
  const visibleSelections = teams.filter((team) => team.isNational && matchesScope(team));

  function keepTeam(current: string, sport: string, country: string, national: boolean) {
    const team = teams.find((item) => item.id === current);
    if (!team || Boolean(team.isNational) !== national) return '';
    if (sport && team.sportId !== sport) return '';
    if (country && team.countryId !== country) return '';
    return current;
  }

  function changeSport(value: string) {
    const nextCountries = value
      ? countries.filter((country) => teams.some((team) => team.sportId === value && team.countryId === country.id))
      : countries;
    const nextCountry = countryId && nextCountries.some((country) => country.id === countryId) ? countryId : '';
    setSportId(value);
    setCountryId(nextCountry);
    setTeamId((current) => keepTeam(current, value, nextCountry, false));
    setSelectionId((current) => (current === '*' ? current : keepTeam(current, value, nextCountry, true)));
  }

  function changeCountry(value: string) {
    setCountryId(value);
    setTeamId((current) => keepTeam(current, sportId, value, false));
    setSelectionId((current) => (current === '*' ? current : keepTeam(current, sportId, value, true)));
  }

  return (
    <section>
      <Head>
        <h1>Produtos</h1>
        <Button as={Link} to="/admin/produtos/novo">Novo produto</Button>
      </Head>
      <Filters onSubmit={(event) => { event.preventDefault(); void load().catch((reason: Error) => setError(reason.message)); }}>
        <Select value={sportId} onChange={(event) => changeSport(event.target.value)}><option value="">Esporte</option>{sports.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={countryId} onChange={(event) => changeCountry(event.target.value)}><option value="">País</option>{visibleCountries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={selectionId} onChange={(event) => { setSelectionId(event.target.value); setTeamId(''); }}><option value="">Seleção</option><option value="*">Todas as seleções</option>{visibleSelections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={teamId} onChange={(event) => { setTeamId(event.target.value); setSelectionId(''); }}><option value="">Time</option>{visibleTeams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Categoria</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Status</option>
          <option value="APPROVED">Aprovado</option>
          <option value="PENDING">Pendente</option>
          <option value="DRAFT">Rascunho</option>
          <option value="IGNORED">Ignorado</option>
        </Select>
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Pesquisar" />
        <Button type="submit" $tone="ink">Filtrar</Button>
      </Filters>
      {message ? <Notice $kind="ok">{message}</Notice> : null}
      {error ? <Notice $kind="error">{error}</Notice> : null}
      <p>{total} produtos</p>
      {!error && items.length === 0 ? <p>Nenhum produto cadastrado.</p> : null}
      <Table>
        <thead><tr><th></th><th>Produto</th><th>Preço</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {items.map((product) => {
            const cover = coverOf(product);
            const place = product.team?.isNational
              ? ['Seleção', product.team.name]
              : [product.country?.name, product.team?.name];
            return (
            <tr key={product.id}>
              <td><Thumb>{cover ? <img src={cover.thumbUrl || cover.url} alt="" /> : null}</Thumb></td>
              <td>{product.name}<small>{[product.sport?.name, ...place].filter(Boolean).join(' · ')}</small></td>
              <td>{formatPrice(product.price)}</td>
              <td>{statusLabel[product.status]} · {product.isActive ? 'Ativo' : 'Inativo'}</td>
              <td>
                <Link to={`/admin/produtos/${product.id}`}>Editar</Link>
                <button type="button" onClick={() => void toggle(product)}>{product.isActive ? 'Desativar' : 'Ativar'}</button>
                <button type="button" onClick={() => void remove(product)}>Excluir</button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </Table>
    </section>
  );
}

const Head = styled.div`display: flex; justify-content: space-between; align-items: center; h1 { font-family: ${({ theme }) => theme.display}; font-size: 48px; text-transform: uppercase; }`;
const Filters = styled.form`display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)) 1.3fr auto; gap: 8px; @media (max-width: 1100px) { grid-template-columns: 1fr 1fr; } @media (max-width: 640px) { grid-template-columns: 1fr; }`;
const Thumb = styled.div`
  width: 48px;
  height: 48px;
  background: ${({ theme }) => theme.paper};
  img { width: 48px; height: 48px; object-fit: cover; display: block; }
`;
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: ${({ theme }) => theme.paperRaised};
  th, td { text-align: left; padding: 10px; border-bottom: 1px solid ${({ theme }) => theme.line}; vertical-align: top; }
  small { display: block; color: ${({ theme }) => theme.muted}; }
  button, a { margin-right: 8px; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; }
`;
