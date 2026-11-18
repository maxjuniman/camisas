import { FormEvent, useEffect, useState } from 'react';
import styled from 'styled-components';
import { Button, Input, Notice } from '../../components/ui';
import { api } from '../../services/api';
import { RefItem } from '../../types';

const tabs = [
  ['teams', 'Times'],
  ['sports', 'Esportes'],
  ['genders', 'Sexo'],
  ['categories', 'Categorias'],
  ['sizes', 'Tamanhos'],
  ['seasons', 'Temporadas'],
] as const;

export function TaxonomiesPage() {
  const [kind, setKind] = useState<(typeof tabs)[number][0]>('teams');
  const [items, setItems] = useState<RefItem[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load(next = kind) {
    const { data } = await api.get<RefItem[]>(`/admin/taxonomies/${next}`);
    setItems(data);
  }

  useEffect(() => {
    void load(kind).catch((reason: Error) => setError(reason.message));
  }, [kind]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api.post(`/admin/taxonomies/${kind}`, { name });
      setName('');
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
      <form onSubmit={create}>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Novo nome" required />
        <Button type="submit">Adicionar</Button>
      </form>
      {message ? <Notice $kind="ok">{message}</Notice> : null}
      {error ? <Notice $kind="error">{error}</Notice> : null}
      <List>
        {items.map((item) => (
          <li key={item.id}>
            <span>{item.name}{item.isActive ? '' : ' · inativo'}</span>
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
