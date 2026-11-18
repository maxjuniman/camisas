import { FormEvent, Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled, { css } from 'styled-components';
import { useDialog } from '../../components/dialog';
import { Modal } from '../../components/modal';
import { Button, Field, Input, Notice } from '../../components/ui';
import { api } from '../../services/api';

type Job = {
  id: string;
  status: string;
  sourceUrl: string;
  forced: boolean;
  createdAt: string;
  finishedAt: string | null;
  foundCount: number;
  cursor: number;
  newCount: number;
  existingCount: number;
  changedCount: number;
  duplicateSuspectCount: number;
  errorCount: number;
  errorLog: string;
};

type Item = {
  id: string;
  rawName: string;
  displayName: string;
  suggestedSizes: string | null;
  suggestedTeam: string | null;
  matchStatus: string;
  reviewStatus: string;
  sourceUrl: string;
};

const statusLabel: Record<string, string> = {
  QUEUED: 'Na fila',
  RUNNING: 'Em execução',
  PAUSED: 'Pausada',
  SUCCEEDED: 'Concluída',
  FAILED: 'Falhou',
  NEW: 'Novo',
  EXISTING: 'Já existente',
  CHANGED: 'Com alterações',
  SUSPECT_DUPLICATE: 'Possível duplicado',
  ERROR: 'Erro',
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  IGNORED: 'Ignorado',
};

export function ImportPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [link, setLink] = useState('');
  const [modal, setModal] = useState<'import' | 'stop' | 'resume' | 'link' | null>(null);
  const [source, setSource] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [price, setPrice] = useState('');
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const dialog = useDialog();

  async function load() {
    const [jobRes, itemRes, sourceRes] = await Promise.all([
      api.get<Job[]>('/admin/scraping/jobs'),
      api.get<Item[]>('/admin/scraping/items', { params: { reviewStatus: 'PENDING' } }),
      api.get<{ url: string }>('/admin/scraping/source'),
    ]);
    setJobs(jobRes.data);
    setItems(itemRes.data);
    setSource(sourceRes.data.url);
  }

  useEffect(() => {
    void load().catch((reason: Error) => setError(reason.message));
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  async function pause(id: string) {
    setError('');
    try {
      await api.post(`/admin/scraping/jobs/${id}/pause`);
      setModal(null);
      setMessage('Importação parada. A camisa em leitura termina e a fila fica parada.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao parar.');
    }
  }

  async function resume(id: string) {
    setError('');
    try {
      await api.post(`/admin/scraping/jobs/${id}/resume`);
      setModal(null);
      setMessage('Importação retomada.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao retomar.');
    }
  }

  async function reset() {
    const confirmed = await dialog.confirm(
      'Zerar a importação apaga a fila, o histórico e os itens ainda não publicados. Produtos já aprovados no site permanecem. Continuar?',
    );
    if (!confirmed) return;
    setError('');
    setResetting(true);
    try {
      await api.post('/admin/scraping/reset');
      setMessage('Importação zerada. A próxima varredura começa do zero neste grupo.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao zerar a importação.');
    } finally {
      setResetting(false);
    }
  }

  async function approveAll() {
    const parsed = price.trim() ? Number(price.replace(',', '.')) : 0;
    if (!Number.isFinite(parsed) || parsed < 0) {
      await dialog.alert('Informe um preço válido ou deixe o campo em branco.');
      return;
    }
    const ready = items.filter((item) => item.matchStatus !== 'ERROR' && item.matchStatus !== 'SUSPECT_DUPLICATE');
    if (!ready.length) {
      await dialog.alert('Não há itens prontos para aprovar. Erros e possíveis duplicados continuam na revisão.');
      return;
    }
    const confirmed = await dialog.confirm(
      `Aprovar ${ready.length} itens sem abrir a revisão? O nome para o site, os tamanhos e as imagens já coletados serão usados. Erros e possíveis duplicados permanecem pendentes.`,
    );
    if (!confirmed) return;
    setError('');
    setApproving(true);
    try {
      const { data } = await api.post<{ approved: number; skipped: number }>('/admin/scraping/approve', {
        price: parsed,
      });
      setMessage(`${data.approved} produtos aprovados. ${data.skipped} ficaram para revisão.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao aprovar.');
    } finally {
      setApproving(false);
    }
  }

  async function start(forced: boolean) {
    setError('');
    try {
      await api.post('/admin/scraping/jobs', { forced });
      setModal(null);
      setMessage(forced ? 'Nova varredura forçada iniciada.' : 'Varredura iniciada.');
      await load();
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : 'Falha ao iniciar.';
      setError(text);
      await dialog.alert(text);
    }
  }

  async function importLink(event: FormEvent) {
    event.preventDefault();
    const url = link.trim();
    if (!url) {
      await dialog.alert('Informe o link do campeonato.');
      return;
    }
    try {
      await api.post('/admin/scraping/import', { url });
      setModal(null);
      setMessage('Importação do campeonato iniciada. As camisas entram separadas por time.');
      await load();
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : 'Falha na importação.';
      setError(text);
      await dialog.alert(text);
    }
  }

  const latest = jobs[0];
  const active = jobs.find((job) => job.status === 'RUNNING' || job.status === 'QUEUED' || job.status === 'PAUSED');

  return (
    <section>
      <h1>Importação de produtos</h1>
      <Actions>
        <Button type="button" onClick={() => setModal('import')} disabled={Boolean(active)}>Importar</Button>
        <Button type="button" $tone="ink" onClick={() => setModal('link')} disabled={Boolean(active)}>Importar por link</Button>
        {active && active.status !== 'PAUSED' ? (
          <Button type="button" $tone="ghost" onClick={() => setModal('stop')}>Parar</Button>
        ) : null}
        {active?.status === 'PAUSED' ? (
          <Button type="button" onClick={() => setModal('resume')}>Retomar</Button>
        ) : null}
        <Button type="button" $tone="ghost" onClick={() => void reset()} disabled={resetting}>Zerar importação</Button>
      </Actions>
      {modal === 'import' ? (
        <Modal title="Importar" onClose={() => setModal(null)}>
          <p>A varredura lê o grupo já configurado{source ? `: ${source}` : ''}.</p>
          <Actions>
            <Button type="button" $tone="ghost" onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="button" $tone="ink" onClick={() => void start(true)}>Forçar</Button>
            <Button type="button" onClick={() => void start(false)}>Iniciar</Button>
          </Actions>
        </Modal>
      ) : null}
      {modal === 'stop' && active ? (
        <Modal title="Parar" onClose={() => setModal(null)}>
          <p>A camisa em leitura termina e a fila fica parada. Dá para retomar depois.</p>
          <Actions>
            <Button type="button" $tone="ghost" onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="button" onClick={() => void pause(active.id)}>Parar importação</Button>
          </Actions>
        </Modal>
      ) : null}
      {modal === 'resume' && active ? (
        <Modal title="Retomar" onClose={() => setModal(null)}>
          <p>A importação continua de onde parou.</p>
          <Actions>
            <Button type="button" $tone="ghost" onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="button" onClick={() => void resume(active.id)}>Retomar importação</Button>
          </Actions>
        </Modal>
      ) : null}
      {modal === 'link' ? (
        <Modal title="Importar por link" onClose={() => setModal(null)}>
          <form onSubmit={(event) => void importLink(event)}>
            <Field>
              Link do campeonato
              <Input value={link} onChange={(event) => setLink(event.target.value)} placeholder="" />
            </Field>
            <p>O link reúne os times. Cada categoria vira um time, e as camisas dele entram nesse time.</p>
            <Actions>
              <Button type="button" $tone="ghost" onClick={() => setModal(null)}>Cancelar</Button>
              <Button type="submit">Importar</Button>
            </Actions>
          </form>
        </Modal>
      ) : null}
      {message ? <Notice $kind="ok">{message}</Notice> : null}
      {error ? <Notice $kind="error">{error}</Notice> : null}
      {active ? (
        <Progress>
          <p>
            {active.status === 'PAUSED'
              ? 'Importação pausada'
              : active.foundCount
                ? `Importando ${active.cursor} de ${active.foundCount}`
                : 'Separando os times'}
          </p>
          <Track>
            <Fill style={{ width: active.foundCount ? `${Math.min(100, Math.round((active.cursor / active.foundCount) * 100))}%` : undefined }} $busy={!active.foundCount} />
          </Track>
          <strong>{active.foundCount ? `${Math.min(100, Math.round((active.cursor / active.foundCount) * 100))}%` : '…'}</strong>
        </Progress>
      ) : null}
      {!active && items.length ? (
        <>
          <h2>Pendentes de aprovação</h2>
          {items.some((item) => item.matchStatus !== 'ERROR' && item.matchStatus !== 'SUSPECT_DUPLICATE') ? (
            <Approve>
              <Input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Preço de todos, se quiser" inputMode="decimal" />
              <Button type="button" onClick={() => void approveAll()} disabled={approving}>Aprovar sem revisar</Button>
            </Approve>
          ) : null}
          {groupItems(items).map(([team, group]) => (
            <div key={team}>
              {team !== 'Sem time' ? <TeamName>{team}</TeamName> : null}
              <List>
                {group.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.displayName || item.rawName}</strong>
                      <small>
                        {item.displayName && item.displayName !== item.rawName ? `${item.rawName} · ` : ''}
                        {statusLabel[item.matchStatus] || item.matchStatus}
                        {item.suggestedSizes ? ` · ${item.suggestedSizes}` : ''}
                      </small>
                    </div>
                    <Link to={`/admin/importacao/itens/${item.id}`}>Revisar</Link>
                  </li>
                ))}
              </List>
            </div>
          ))}
        </>
      ) : !active ? (
        <p>{latest && latest.newCount === 0 ? 'Nada novo nesta varredura.' : 'Nenhum item pendente.'}</p>
      ) : null}
      <h2>Histórico</h2>
      {jobs.length ? (
        <table>
          <thead>
            <tr><th>Data</th><th>Status</th><th>Encontrados</th><th>Novos</th><th>Duplicados</th><th>Alterações</th><th>Erros</th><th></th></tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <Fragment key={job.id}>
                <tr>
                  <td>{new Date(job.createdAt).toLocaleString('pt-BR')}</td>
                  <td>{statusLabel[job.status] || job.status}</td>
                  <td>{job.foundCount}</td>
                  <td>{job.newCount}</td>
                  <td>{job.duplicateSuspectCount}</td>
                  <td>{job.changedCount}</td>
                  <td>{job.errorCount}</td>
                  <td>
                    <DetailsButton type="button" onClick={() => setOpenJobId((current) => current === job.id ? null : job.id)}>
                      {openJobId === job.id ? 'Fechar' : 'Detalhes'}
                    </DetailsButton>
                  </td>
                </tr>
                {openJobId === job.id ? (
                  <tr key={`${job.id}-details`}>
                    <td colSpan={8}>
                      <Summary>
                        {job.sourceUrl ? <p>Link: {job.sourceUrl}</p> : null}
                        <p>Execução: {new Date(job.finishedAt || job.createdAt).toLocaleString('pt-BR')}</p>
                        <p>Status: {statusLabel[job.status] || job.status}</p>
                        <p>Progresso: {job.cursor} de {job.foundCount} · Novos: {job.newCount} · Existentes: {job.existingCount}</p>
                        <p>Alterações: {job.changedCount} · Possíveis duplicados: {job.duplicateSuspectCount} · Erros: {job.errorCount}</p>
                        {job.errorLog ? <pre>{job.errorLog}</pre> : null}
                      </Summary>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      ) : <p>Nenhuma varredura executada.</p>}
    </section>
  );
}

function groupItems(items: Item[]) {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = item.suggestedTeam?.trim() || 'Sem time';
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()].sort((left, right) => left[0].localeCompare(right[0], 'pt-BR'));
}

const Actions = styled.div`display: flex; gap: 8px; flex-wrap: wrap; align-items: center;`;
const Progress = styled.div`
  display: grid;
  gap: 8px;
  max-width: 560px;
  p, strong { margin: 0; }
  strong { font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }
`;
const Track = styled.div`
  height: 12px;
  background: ${({ theme }) => theme.line};
  overflow: hidden;
`;
const Fill = styled.div<{ $busy?: boolean }>`
  height: 100%;
  width: 0;
  background: ${({ theme }) => theme.accent};
  ${({ $busy }) => $busy && css`
    width: 35%;
    animation: import-slide 1.1s ease-in-out infinite;
    @keyframes import-slide {
      from { transform: translateX(-120%); }
      to { transform: translateX(320%); }
    }
  `}
`;
const TeamName = styled.h3`margin: 18px 0 0; font-size: 18px;`;
const Approve = styled.div`display: flex; gap: 8px; flex-wrap: wrap; align-items: center; max-width: 520px; input { max-width: 240px; }`;
const DetailsButton = styled.button`
  background: transparent;
  border: 0;
  padding: 0;
  color: ${({ theme }) => theme.ink};
  text-decoration: underline;
  cursor: pointer;
  font: inherit;
`;
const Summary = styled.div`
  border: 1px solid ${({ theme }) => theme.line};
  padding: 12px;
  background: ${({ theme }) => theme.paper};
  p { margin: 0 0 6px; overflow-wrap: anywhere; }
  pre { white-space: pre-wrap; font-size: 12px; margin: 0; }
`;
const List = styled.ul`
  list-style: none; padding: 0;
  li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid ${({ theme }) => theme.line}; }
  small { display: block; color: ${({ theme }) => theme.muted}; }
`;
