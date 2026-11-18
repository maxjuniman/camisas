import { FormEvent, useEffect, useState } from 'react';
import styled from 'styled-components';
import { Button, Input, Notice, Select } from '../../components/ui';
import { api } from '../../services/api';
import { RefItem } from '../../types';

const tabs = [
  ['teams', 'Times'],
  ['sports', 'Esportes'],
  ['countries', 'Países'],
  ['genders', 'Sexo'],
  ['categories', 'Categorias'],
  ['sizes', 'Tamanhos'],
  ['seasons', 'Temporadas'],
] as const;

export function TaxonomiesPage() {
  const [kind, setKind] = useState<(typeof tabs)[number][0]>('teams');
  const [items, setItems] = useState<RefItem[]>([]);
  const [name, setName] = useState('');
  const [sportId, setSportId] = useState('');
  const [countryId, setCountryId] = useState('');
  const [sports, setSports] = useState<RefItem[]>([]);
  const [countries, setCountries] = useState<RefItem[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load(next = kind) {
    const { data } = await api.get<RefItem[]>(`/admin/taxonomies/${next}`);
    setItems(data);
  }

  useEffect(() => {
    void load(kind).catch((reason: Error) => setError(reason.message));
    if (kind !== 'teams') return;
    Promise.all([
      api.get<RefItem[]>('/admin/taxonomies/sports'),
      api.get<RefItem[]>('/admin/taxonomies/countries'),
    ]).then(([sportRes, countryRes]) => {
      setSports(sportRes.data);
      setCountries(countryRes.data);
    }).catch(() => undefined);
  }, [kind]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api.post(`/admin/taxonomies/${kind}`, {
        name,
        ...(kind === 'teams' ? { sportId: sportId || null, countryId: countryId || null } : {}),
      });
      setName('');
      setSportId('');
      setCountryId('');
      setMessage('Cadastro criado.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao criar.');
    }
  }

  async function rename(item: RefItem) {
    const next = window.prompt('Novo nome', item.name);
    if (!next || next === item.name) return;
    await api.patch(`/admin/taxonomies/${kind}/${item.id}`, { name: next });
    await load();
  }

  async function toggle(item: RefItem) {
    await api.patch(`/admin/taxonomies/${kind}/${item.id}`, { isActive: !item.isActive });
    await load();
  }

  async function remove(item: RefItem) {
    if (!window.confirm(`Excluir ${item.name}?`)) return;
    try {
      await api.delete(`/admin/taxonomies/${kind}/${item.id}`);
      setMessage('Cadastro excluído.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível excluir.');
    }
  }

  return (
    <section>
      <h1>Cadastros</h1>
      <Tabs>
        {tabs.map(([value, label]) => (
          <button key={value} type="button" data-on={kind === value} onClick={() => setKind(value)}>{label}</button>
        ))}
      </Tabs>
      <Creator onSubmit={create}>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Novo nome" required />
        {kind === 'teams' ? (
          <>
            <Select value={sportId} onChange={(event) => setSportId(event.target.value)} aria-label="Esporte">
              <option value="">Esporte</option>
              {sports.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
            <Select value={countryId} onChange={(event) => setCountryId(event.target.value)} aria-label="País">
              <option value="">País</option>
              {countries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </>
        ) : null}
        <Button type="submit">Adicionar</Button>
      </Creator>
      {message ? <Notice $kind="ok">{message}</Notice> : null}
      {error ? <Notice $kind="error">{error}</Notice> : null}
      <List>
        {items.map((item) => (
          <li key={item.id}>
            <span>
              {item.name}
              {item.sport?.name ? ` · ${item.sport.name}` : ''}
              {item.country?.name ? ` · ${item.country.name}` : ''}
              {item.isActive ? '' : ' · inativo'}
            </span>
            <span>
              <button type="button" onClick={() => void rename(item)}>Editar</button>
              <button type="button" onClick={() => void toggle(item)}>{item.isActive ? 'Desativar' : 'Ativar'}</button>
              <button type="button" onClick={() => void remove(item)}>Excluir</button>
            </span>
          </li>
        ))}
      </List>
    </section>
  );
}

const Creator = styled.form`display: grid; gap: 8px; max-width: 420px;`;
const Tabs = styled.div`
  display: flex; flex-wrap: wrap; gap: 8px;
  button { background: transparent; border: 1px solid ${({ theme }) => theme.line}; padding: 8px 10px; cursor: pointer; }
  button[data-on='true'] { background: ${({ theme }) => theme.ink}; color: ${({ theme }) => theme.paper}; }
`;
const List = styled.ul`
  list-style: none; padding: 0; display: grid; gap: 8px;
  li { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid ${({ theme }) => theme.line}; padding: 8px 0; }
  button { background: none; border: 0; margin-left: 8px; text-decoration: underline; cursor: pointer; }
`;
