import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useDialog } from '../../components/dialog';
import { Modal } from '../../components/modal';
import { Button, Field, Input, Notice, Select } from '../../components/ui';
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
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkScope, setBulkScope] = useState<'ids' | 'filter' | null>(null);
  const [bulkSportId, setBulkSportId] = useState('');
  const [bulkCountryId, setBulkCountryId] = useState('');
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [bulkTeamId, setBulkTeamId] = useState('');
  const [translateNames, setTranslateNames] = useState(true);
  const [saving, setSaving] = useState(false);
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
    setPicked([]);
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

  function togglePick(id: string) {
    setPicked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function openBulk(scope: 'ids' | 'filter') {
    setBulkScope(scope);
    setBulkSportId('');
    setBulkCountryId('');
    setBulkCategoryId('');
    setBulkTeamId('');
    setTranslateNames(true);
  }

  async function applyBulk(event: FormEvent) {
    event.preventDefault();
    if (!bulkScope) return;
    if (!bulkSportId && !bulkCountryId && !bulkCategoryId && !bulkTeamId && !translateNames) {
      await dialog.alert('Escolha ao menos uma alteração.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post<{ updated: number }>('/admin/products/bulk', {
        scope: bulkScope,
        ids: bulkScope === 'ids' ? picked : undefined,
        q,
        filterTeamId: selectionId && selectionId !== '*' ? selectionId : teamId,
        filterSportId: sportId,
        filterCountryId: countryId,
        filterCategoryId: categoryId,
        status,
        national: selectionId === '*' ? true : undefined,
        sportId: bulkSportId || undefined,
        countryId: bulkCountryId || undefined,
        categoryId: bulkCategoryId || undefined,
        teamId: bulkTeamId || undefined,
        translateNames,
      });
      setMessage(`${data.updated} produtos atualizados.`);
      setBulkScope(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao editar os produtos.');
    } finally {
      setSaving(false);
    }
  }

  const bulkTeams = teams.filter((team) => !team.isNational && (!bulkSportId || team.sportId === bulkSportId) && (!bulkCountryId || team.countryId === bulkCountryId));

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
      <Toolbar>
        <p>{total} produtos</p>
        <span>
          <TextLink type="button" onClick={() => setPicked(picked.length === items.length && items.length ? [] : items.map((product) => product.id))}>
            {picked.length === items.length && items.length ? 'Limpar seleção' : 'Selecionar esta página'}
          </TextLink>
          <Button type="button" $tone="ghost" disabled={!picked.length} onClick={() => openBulk('ids')}>Editar selecionados ({picked.length})</Button>
          <Button type="button" disabled={!total} onClick={() => openBulk('filter')}>Editar todos do filtro ({total})</Button>
        </span>
      </Toolbar>
      {!error && items.length === 0 ? <p>Nenhum produto cadastrado.</p> : null}
      <Table>
        <thead><tr><th></th><th></th><th>Produto</th><th>Preço</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {items.map((product) => {
            const cover = coverOf(product);
            const place = product.team?.isNational
              ? ['Seleção', product.team.name]
              : [product.country?.name, product.team?.name];
            return (
            <tr key={product.id}>
              <td><input type="checkbox" checked={picked.includes(product.id)} onChange={() => togglePick(product.id)} aria-label={`Selecionar ${product.name}`} /></td>
              <td><Thumb>{cover ? <img src={cover.thumbUrl || cover.url} alt="" /> : null}</Thumb></td>
              <td>{product.name}<small>{[product.sport?.name, ...place].filter(Boolean).join(' · ')}</small></td>
              <td>{formatPrice(product.price)}</td>
              <td>{product.discontinued ? 'Fora de fabricação' : `${statusLabel[product.status]} · ${product.isActive ? 'Ativo' : 'Inativo'}`}</td>
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
      {bulkScope ? (
        <Modal title={bulkScope === 'ids' ? `Editar ${picked.length} produtos` : `Editar ${total} produtos`} onClose={() => setBulkScope(null)}>
          <form onSubmit={(event) => void applyBulk(event)}>
            <p>O que ficar em “Não alterar” permanece como está. O time, se escolhido, vale para todos. Traduzir nomes lê a legenda de cada peça e separa o time.</p>
            <Grid>
              <Field>Esporte<Select value={bulkSportId} onChange={(event) => { setBulkSportId(event.target.value); setBulkTeamId(''); }}><option value="">Não alterar</option>{sports.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
              <Field>País<Select value={bulkCountryId} onChange={(event) => { setBulkCountryId(event.target.value); setBulkTeamId(''); }}><option value="">Não alterar</option>{countries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
              <Field>Categoria<Select value={bulkCategoryId} onChange={(event) => setBulkCategoryId(event.target.value)}><option value="">Não alterar</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
              <Field>Time<Select value={bulkTeamId} onChange={(event) => setBulkTeamId(event.target.value)}><option value="">Não alterar</option>{bulkTeams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
            </Grid>
            <label><input type="checkbox" checked={translateNames} onChange={(event) => setTranslateNames(event.target.checked)} /> Traduzir nomes para português</label>
            <Actions>
              <Button type="button" $tone="ghost" onClick={() => setBulkScope(null)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Aplicar'}</Button>
            </Actions>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}

const Head = styled.div`display: flex; justify-content: space-between; align-items: center; h1 { font-family: ${({ theme }) => theme.display}; font-size: 48px; text-transform: uppercase; }`;
const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  span { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
`;
const TextLink = styled.button`background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; font: inherit;`;
const Grid = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0;`;
const Actions = styled.div`display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;`;
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
