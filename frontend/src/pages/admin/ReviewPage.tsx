import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { useDialog } from '../../components/dialog';
import { Button, Field, Input, Notice, Select, TextArea } from '../../components/ui';
import { api } from '../../services/api';
import { Product, RefItem } from '../../types';

type ReviewItem = {
  id: string;
  rawName: string;
  displayName: string;
  rawDescription: string;
  sourceUrl: string;
  externalId: string | null;
  matchStatus: string;
  suggestedTeam: string | null;
  suggestedGender: string | null;
  suggestedCategory: string | null;
  suggestedSizes: string | null;
  images: { id: string; url: string | null; thumbUrl: string | null }[];
  changes: { id: string; field: string; previousValue: string; nextValue: string }[];
  duplicates: { id: string; reason: string; score: number; product: Product }[];
  linkedProduct: Product | null;
};

type Lists = Record<'teams' | 'sports' | 'countries' | 'genders' | 'categories' | 'seasons' | 'sizes', RefItem[]>;

export function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<ReviewItem | null>(null);
  const [lists, setLists] = useState<Lists | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [teamId, setTeamId] = useState('');
  const [sportId, setSportId] = useState('');
  const [countryId, setCountryId] = useState('');
  const [genderId, setGenderId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [sizeIds, setSizeIds] = useState<string[]>([]);
  const [importImages, setImportImages] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [availableForOrder, setAvailableForOrder] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isLaunch, setIsLaunch] = useState(false);
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [error, setError] = useState('');
  const dialog = useDialog();

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<ReviewItem>(`/admin/scraping/items/${id}`),
      api.get<RefItem[]>('/admin/taxonomies/teams'),
      api.get<RefItem[]>('/admin/taxonomies/sports'),
      api.get<RefItem[]>('/admin/taxonomies/countries'),
      api.get<RefItem[]>('/admin/taxonomies/genders'),
      api.get<RefItem[]>('/admin/taxonomies/categories'),
      api.get<RefItem[]>('/admin/taxonomies/seasons'),
      api.get<RefItem[]>('/admin/taxonomies/sizes'),
    ]).then(([itemRes, teams, sports, countries, genders, categories, seasons, sizes]) => {
      const current = itemRes.data;
      const nextLists = {
        teams: teams.data,
        sports: sports.data,
        countries: countries.data,
        genders: genders.data,
        categories: categories.data,
        seasons: seasons.data,
        sizes: sizes.data,
      };
      setLists(nextLists);
      setItem(current);
      const product = current.linkedProduct;
      setName(product?.name || current.displayName || current.rawName);
      setDescription(product?.description || current.rawDescription);
      setPrice(String(product?.price ?? 0));
      const matchedTeamId = product?.team?.id || matchName(nextLists.teams, current.suggestedTeam);
      const matchedTeam = nextLists.teams.find((team) => team.id === matchedTeamId);
      setTeamId(matchedTeamId);
      setSportId(product?.sport?.id || matchedTeam?.sportId || nextLists.sports.find((sport) => sport.slug === 'futebol')?.id || '');
      setCountryId(product?.country?.id || matchedTeam?.countryId || '');
      setGenderId(product?.gender?.id || matchName(nextLists.genders, current.suggestedGender));
      setCategoryId(product?.category?.id || matchName(nextLists.categories, current.suggestedCategory));
      setSeasonId(product?.season?.id || matchSeason(nextLists.seasons, current.rawName));
      const suggested = new Set((current.suggestedSizes || '').split(',').map((size) => size.trim().toLowerCase()).filter(Boolean));
      setSizeIds(product?.sizes.map((size) => size.id) || nextLists.sizes.filter((size) => suggested.has(size.name.toLowerCase())).map((size) => size.id));
      setIsActive(product?.isActive ?? true);
      setAvailableForOrder(product?.availableForOrder ?? true);
      setIsFeatured(product?.isFeatured ?? false);
      setIsLaunch(product?.isLaunch ?? false);
      setAvailabilityNote(product?.availabilityNote || '');
      setOrderNote(product?.orderNote || '');
      setImportImages(!product);
    }).catch((reason: Error) => setError(reason.message));
  }, [id]);

  async function approve(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    try {
      await api.post(`/admin/scraping/items/${id}/review`, {
        action: 'approve',
        name,
        description,
        price: Number(price),
        teamId: teamId || null,
        sportId: sportId || null,
        countryId: countryId || null,
        genderId: genderId || null,
        categoryId: categoryId || null,
        seasonId: seasonId || null,
        sizeIds,
        importImages,
        isActive,
        availableForOrder,
        isFeatured,
        isLaunch,
        availabilityNote,
        orderNote,
      });
      navigate('/admin/importacao');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao aprovar.');
    }
  }

  async function ignore() {
    if (!id) return;
    await api.post(`/admin/scraping/items/${id}/review`, { action: 'ignore' });
    navigate('/admin/importacao');
  }

  async function release() {
    if (!id) return;
    try {
      await api.post(`/admin/scraping/items/${id}/release`);
      setItem((current) => (current ? { ...current, matchStatus: 'NEW' } : current));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao marcar como peça nova.');
    }
  }

  async function drop() {
    if (!id) return;
    try {
      await api.post(`/admin/scraping/items/${id}/discontinue`);
      navigate('/admin/importacao');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao retirar a peça.');
    }
  }

  async function remove() {
    if (!id || !(await dialog.confirm('Excluir este item encontrado? O produto da loja, se já existir, permanece.'))) return;
    await api.delete(`/admin/scraping/items/${id}`);
    navigate('/admin/importacao');
  }

  function chooseTeam(value: string) {
    setTeamId(value);
    const team = lists?.teams.find((entry) => entry.id === value);
    if (team?.sportId) setSportId(team.sportId);
    if (team?.countryId) setCountryId(team.countryId);
  }

  if (!item) return <p>{error || 'Carregando...'}</p>;

  if (item.matchStatus === 'ERROR') {
    return (
      <section>
        <h1>Erro na importação</h1>
        <p><strong>{item.displayName || item.rawName}</strong></p>
        <p>Motivo: {item.rawDescription || 'A leitura desta peça falhou.'}</p>
        <p><a href={item.sourceUrl} target="_blank" rel="noreferrer">Abrir no fornecedor</a></p>
        {error ? <Notice $kind="error">{error}</Notice> : null}
        <Actions>
          <Button type="button" $tone="ink" onClick={() => void ignore()}>Ignorar</Button>
        </Actions>
      </section>
    );
  }

  if (item.matchStatus === 'DISCONTINUED') {
    return (
      <section>
        <h1>Fora de fabricação</h1>
        <p>{item.displayName || item.rawName} está no catálogo e não voltou no grupo do fornecedor.</p>
        {error ? <Notice $kind="error">{error}</Notice> : null}
        <Actions>
          <Button type="button" onClick={() => void drop()}>Tirar do catálogo</Button>
          <Button type="button" $tone="ink" onClick={() => void ignore()}>Manter no catálogo</Button>
        </Actions>
      </section>
    );
  }

  if (!lists) return <p>{error || 'Carregando...'}</p>;

  return (
    <section>
      <h1>Revisar produto</h1>
      <p><a href={item.sourceUrl} target="_blank" rel="noreferrer">Abrir no fornecedor</a></p>
      {item.externalId ? <p>ID original: {item.externalId}</p> : null}
      <Gallery>
        {item.images.map((image) => image.url ? <img key={image.id} src={image.thumbUrl || image.url} alt="" /> : null)}
      </Gallery>
      {item.duplicates.length ? (
        <>
          <Notice $kind="error">
            {item.duplicates.map((candidate) => (
              <span key={candidate.id}>
                Parece a mesma peça que {candidate.product.name}, porque {duplicateReason(candidate.reason)} ({Math.round(candidate.score * 100)}%).{' '}
              </span>
            ))}
          </Notice>
          {item.matchStatus === 'SUSPECT_DUPLICATE' ? (
            <Actions>
              <Button type="button" onClick={() => void ignore()}>É duplicado</Button>
              <Button type="button" $tone="ink" onClick={() => void release()}>Não é duplicado</Button>
            </Actions>
          ) : null}
        </>
      ) : null}
      {item.changes.length ? (
        <div>
          {item.changes.map((change) => (
            <p key={change.id}>{change.field}: de “{change.previousValue}” para “{change.nextValue}”.</p>
          ))}
          <Button type="button" $tone="ghost" onClick={() => { setName(item.rawName); setDescription(item.rawDescription); }}>Usar texto do fornecedor</Button>
        </div>
      ) : null}
      <Form onSubmit={approve}>
        <Field>
          Nome original
          <Input value={item.rawName} readOnly />
        </Field>
        <Field>
          Nome para o site
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <p>O nome original vem do fornecedor. O nome para o site é o que aparece no catálogo público.</p>
        <Button type="button" $tone="ghost" onClick={() => setName(item.rawName)}>Usar nome original</Button>
        <Field>Descrição<TextArea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
        <Field>Preço<Input type="number" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></Field>
        <SelectField label="Esporte" value={sportId} setValue={setSportId} options={lists.sports} />
        <SelectField label="País" value={countryId} setValue={setCountryId} options={lists.countries} />
        <SelectField label="Time" value={teamId} setValue={(value) => chooseTeam(value)} options={lists.teams} />
        <SelectField label="Sexo" value={genderId} setValue={setGenderId} options={lists.genders} />
        <SelectField label="Categoria" value={categoryId} setValue={setCategoryId} options={lists.categories} />
        <SelectField label="Temporada" value={seasonId} setValue={setSeasonId} options={lists.seasons} />
        <fieldset>
          <legend>Tamanhos {item.suggestedSizes ? `· sugestão ${item.suggestedSizes}` : ''}</legend>
          {lists.sizes.map((size) => (
            <label key={size.id}>
              <input type="checkbox" checked={sizeIds.includes(size.id)} onChange={() => setSizeIds((current) => current.includes(size.id) ? current.filter((value) => value !== size.id) : [...current, size.id])} />
              {size.name}
            </label>
          ))}
        </fieldset>
        <label><input type="checkbox" checked={importImages} onChange={(event) => setImportImages(event.target.checked)} /> Trazer imagens novas</label>
        <label><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Ativo</label>
        <label><input type="checkbox" checked={availableForOrder} onChange={(event) => setAvailableForOrder(event.target.checked)} /> Disponível para encomenda</label>
        <label><input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} /> Destaque</label>
        <label><input type="checkbox" checked={isLaunch} onChange={(event) => setIsLaunch(event.target.checked)} /> Lançamento</label>
        <Field>Disponibilidade<TextArea value={availabilityNote} onChange={(event) => setAvailabilityNote(event.target.value)} /></Field>
        <Field>Observações<TextArea value={orderNote} onChange={(event) => setOrderNote(event.target.value)} /></Field>
        {error ? <Notice $kind="error">{error}</Notice> : null}
        <Actions>
          <Button type="submit">Aprovar e publicar</Button>
          <Button type="button" $tone="ink" onClick={() => void ignore()}>Ignorar</Button>
          <Button type="button" $tone="ghost" onClick={() => void remove()}>Excluir</Button>
        </Actions>
      </Form>
    </section>
  );
}

function duplicateReason(reason: string) {
  if (reason === 'IMAGE') return 'a foto é parecida';
  if (reason === 'BOTH') return 'o nome e a foto são parecidos';
  return 'o nome é parecido';
}

function matchSeason(options: RefItem[], title: string) {
  const full = title.match(/\b(20\d{2})\/(\d{2})\b/);
  const slash = title.match(/\b(\d{2})\/(\d{2})\b/);
  const chinese = title.match(/(\d{2})\s*赛季/);
  const bare = !chinese && /[\u3400-\u9fff]/.test(title) ? title.match(/(?:^|\s)(\d{2})(?=\s)/) : null;
  const name = full
    ? `${full[1]}/${full[2]}`
    : slash
      ? `20${slash[1]}/${slash[2]}`
      : chinese
        ? `${2000 + Number(chinese[1]) - 1}/${chinese[1]}`
        : bare
          ? `${2000 + Number(bare[1]) - 1}/${bare[1]}`
          : '';
  if (!name) return '';
  return options.find((item) => item.name === name)?.id || '';
}

function matchName(options: RefItem[], name: string | null) {
  if (!name) return '';
  return options.find((item) => item.name.toLowerCase() === name.toLowerCase())?.id || '';
}

function SelectField({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: RefItem[] }) {
  return (
    <Field>
      {label}
      <Select value={value} onChange={(event) => setValue(event.target.value)}>
        <option value="">Selecione</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </Select>
    </Field>
  );
}

const Gallery = styled.div`display: flex; gap: 8px; overflow: auto; img { width: 120px; height: 150px; object-fit: cover; }`;
const Form = styled.form`display: grid; gap: 12px; max-width: 760px; fieldset { border: 1px solid ${({ theme }) => theme.line}; display: flex; gap: 10px; flex-wrap: wrap; }`;
const Actions = styled.div`display: flex; gap: 8px; flex-wrap: wrap;`;
