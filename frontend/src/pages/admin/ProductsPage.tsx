import { FormEvent, useEffect, useRef, useState } from 'react';
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [total, setTotal] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkScope, setBulkScope] = useState<'ids' | 'filter' | null>(null);
  const [bulkSportId, setBulkSportId] = useState('');
  const [bulkCountryId, setBulkCountryId] = useState('');
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [bulkTeamId, setBulkTeamId] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [translateNames, setTranslateNames] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dialog = useDialog();

  async function load(nextPage = page) {
    const current = ++requestId.current;
    setLoading(true);
    setError('');
    const params = Object.fromEntries(
      Object.entries({
        q: q.trim(),
        teamId: selectionId && selectionId !== '*' ? selectionId : teamId,
        sportId,
        countryId,
        categoryId,
        status,
        national: selectionId === '*' ? 'true' : '',
        page: String(nextPage),
      }).filter(([, value]) => value.trim()),
    );
    try {
      const { data } = await api.get<Page>('/admin/products', { params });
      if (current !== requestId.current) return;
      const size = data.pageSize || 100;
      const last = Math.max(1, Math.ceil(data.total / size));
      if (nextPage > last) return load(last);
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page || nextPage);
      setPageSize(size);
      setPicked([]);
    } finally {
      if (current === requestId.current) setLoading(false);
    }
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

  const visibleCountries = countries;
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
    setSportId(value);
    setTeamId((current) => keepTeam(current, value, countryId, false));
    setSelectionId((current) => (current === '*' ? current : keepTeam(current, value, countryId, true)));
  }

  function changeCountry(value: string) {
    setCountryId(value);
    setTeamId((current) => keepTeam(current, sportId, value, false));
    setSelectionId((current) => (current === '*' ? current : keepTeam(current, sportId, value, true)));
  }

  function togglePick(id: string) {
    setPicked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function shared(values: string[]) {
    if (!values.length) return '';
    return values.every((value) => value === values[0]) ? values[0] : '';
  }

  function openBulk(scope: 'ids' | 'filter') {
    const selected = scope === 'ids' ? items.filter((product) => picked.includes(product.id)) : [];
    setBulkScope(scope);
    setBulkSportId(shared(selected.map((product) => product.sport?.id || '')));
    setBulkCountryId(shared(selected.map((product) => product.country?.id || '')));
    setBulkCategoryId(shared(selected.map((product) => product.category?.id || '')));
    setBulkTeamId(shared(selected.map((product) => product.team?.id || '')));
    const price = shared(selected.map((product) => String(product.price)));
    setBulkPrice(price);
    setTranslateNames(false);
  }

  async function applyBulk(event: FormEvent) {
    event.preventDefault();
    if (!bulkScope) return;
    const parsedPrice = bulkPrice.trim() ? Number(bulkPrice.replace(',', '.')) : undefined;
    if (parsedPrice != null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      await dialog.alert('Informe um valor válido.');
      return;
    }
    if (parsedPrice == null && !bulkSportId && !bulkCountryId && !bulkCategoryId && !bulkTeamId && !translateNames) {
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
        price: parsedPrice,
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
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function go(next: number) {
    void load(next).then(() => window.scrollTo({ top: 0, behavior: 'smooth' })).catch((reason: Error) => setError(reason.message));
  }

  const pager = pages > 1 ? (
    <Pages>
      <Button type="button" $tone="ghost" disabled={loading || page <= 1} onClick={() => go(page - 1)}>Anterior</Button>
      {pageList(page, pages).map((entry, index) => (
        entry === '…' ? <span key={`gap-${index}`}>…</span> : (
          <Button key={entry} type="button" $tone={entry === page ? 'ink' : 'ghost'} disabled={loading || entry === page} onClick={() => go(entry)}>{entry}</Button>
        )
      ))}
      <Button type="button" $tone="ghost" disabled={loading || page >= pages} onClick={() => go(page + 1)}>Próxima</Button>
    </Pages>
  ) : null;

  return (
    <section>
      <Head>
        <h1>Produtos</h1>
        <Button as={Link} to="/admin/produtos/novo">Novo produto</Button>
      </Head>
      <Filters onSubmit={(event) => { event.preventDefault(); void load(1).catch((reason: Error) => setError(reason.message)); }}>
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
        <Button type="submit" $tone="ink" disabled={loading}>{loading ? 'Buscando...' : 'Filtrar'}</Button>
      </Filters>
      {message ? <Notice $kind="ok">{message}</Notice> : null}
      {error ? <Notice $kind="error">{error}</Notice> : null}
      <Toolbar>
        <p>{loading ? 'Buscando...' : `${total} produtos`}{!loading && pages > 1 ? ` · página ${page} de ${pages}` : ''}</p>
        <span>
          <TextLink type="button" onClick={() => setPicked(picked.length === items.length && items.length ? [] : items.map((product) => product.id))}>
            {picked.length === items.length && items.length ? 'Limpar seleção' : 'Selecionar esta página'}
          </TextLink>
          <Button type="button" $tone="ghost" disabled={!picked.length} onClick={() => openBulk('ids')}>Editar selecionados ({picked.length})</Button>
          <Button type="button" disabled={!total} onClick={() => openBulk('filter')}>Editar todos do filtro ({total})</Button>
        </span>
      </Toolbar>
      {pager}
      {!loading && !error && items.length === 0 ? <p>Nenhum produto encontrado.</p> : null}
      <Table $loading={loading}>
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
      {pager}
      {bulkScope ? (
        <Modal title={bulkScope === 'ids' ? `Editar ${picked.length} produtos` : `Editar ${total} produtos`} onClose={() => setBulkScope(null)}>
          <form onSubmit={(event) => void applyBulk(event)}>
            <p>O que ficar em “Não alterar” permanece como está. O valor e o time, se preenchidos, valem para todos. Traduzir nomes lê a legenda de cada peça e separa o time.</p>
            <Grid>
              <Field>Valor<Input value={bulkPrice} onChange={(event) => setBulkPrice(event.target.value)} inputMode="decimal" placeholder="Não alterar" /></Field>
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
const Pages = styled.nav`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;
  span { color: ${({ theme }) => theme.muted}; }
`;

function pageList(current: number, last: number): Array<number | '…'> {
  const wanted = [1, current - 1, current, current + 1, last].filter((value, index, list) => value >= 1 && value <= last && list.indexOf(value) === index);
  const list: Array<number | '…'> = [];
  wanted.forEach((value, index) => {
    if (index > 0 && value - wanted[index - 1] > 1) list.push('…');
    list.push(value);
  });
  return list;
}
const Filters = styled.form`display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)) 1.3fr auto; gap: 8px; @media (max-width: 1100px) { grid-template-columns: 1fr 1fr; } @media (max-width: 640px) { grid-template-columns: 1fr; }`;
const Thumb = styled.div`
  width: 48px;
  height: 48px;
  background: ${({ theme }) => theme.paper};
  img { width: 48px; height: 48px; object-fit: cover; display: block; }
`;
const Table = styled.table<{ $loading?: boolean }>`
  width: 100%;
  border-collapse: collapse;
  background: ${({ theme }) => theme.paperRaised};
  opacity: ${({ $loading }) => ($loading ? 0.45 : 1)};
  th, td { text-align: left; padding: 10px; border-bottom: 1px solid ${({ theme }) => theme.line}; vertical-align: top; }
  small { display: block; color: ${({ theme }) => theme.muted}; }
  button, a { margin-right: 8px; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; }
`;
