import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useDialog } from '../../components/dialog';
import { Button, Input, Notice, TextArea } from '../../components/ui';
import { api } from '../../services/api';

type Job = {
  id: string;
  status: string;
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
  const [urls, setUrls] = useState('');
  const [source, setSource] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [price, setPrice] = useState('');
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
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  async function pause(id: string) {
    setError('');
    try {
      await api.post(`/admin/scraping/jobs/${id}/pause`);
      setMessage('Importação pausada. O álbum em leitura termina e a fila fica parada.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao pausar.');
    }
  }

  async function resume(id: string) {
    setError('');
    try {
      await api.post(`/admin/scraping/jobs/${id}/resume`);
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
      setMessage(forced ? 'Nova varredura forçada iniciada.' : 'Varredura iniciada.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao iniciar.');
    }
  }

  async function importUrls(event: FormEvent) {
    event.preventDefault();
    const list = urls.split(/\s+/).map((item) => item.trim()).filter(Boolean);
    try {
      await api.post('/admin/scraping/import', { urls: list });
      setUrls('');
      setMessage('Importação por links iniciada.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha na importação.');
    }
  }

  const latest = jobs[0];
  const active = jobs.find((job) => job.status === 'RUNNING' || job.status === 'QUEUED' || job.status === 'PAUSED');

  return (
    <section>
      <h1>Importação de produtos</h1>
      <Actions>
        <Button type="button" onClick={() => void start(false)} disabled={Boolean(active)}>Iniciar varredura</Button>
        <Button type="button" $tone="ink" onClick={() => void start(true)} disabled={Boolean(active)}>Forçar nova varredura</Button>
        {active && active.status !== 'PAUSED' ? (
          <Button type="button" $tone="ghost" onClick={() => void pause(active.id)}>Pausar importação</Button>
        ) : null}
        {active?.status === 'PAUSED' ? (
          <Button type="button" onClick={() => void resume(active.id)}>Retomar importação</Button>
        ) : null}
        <Button type="button" $tone="ghost" onClick={() => void reset()} disabled={resetting}>Zerar importação</Button>
      </Actions>
      {source ? <p>Próxima varredura: {source}</p> : null}
      {latest ? (
        <Summary>
          <p>Última execução: {new Date(latest.finishedAt || latest.createdAt).toLocaleString('pt-BR')}</p>
          <p>Status: {statusLabel[latest.status] || latest.status}</p>
          <p>Progresso: {latest.cursor} de {latest.foundCount} · Novos: {latest.newCount} · Existentes: {latest.existingCount}</p>
          <p>Alterações: {latest.changedCount} · Possíveis duplicados: {latest.duplicateSuspectCount} · Erros: {latest.errorCount}</p>
          {latest.errorLog ? <pre>{latest.errorLog}</pre> : null}
        </Summary>
      ) : <p>Nenhuma varredura executada.</p>}
      {message ? <Notice $kind="ok">{message}</Notice> : null}
      {error ? <Notice $kind="error">{error}</Notice> : null}
      <h2>Pendentes de aprovação</h2>
      {items.length ? (
        <Approve>
          <Input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Preço de todos, se quiser" inputMode="decimal" />
          <Button type="button" onClick={() => void approveAll()} disabled={approving}>Aprovar sem revisar</Button>
        </Approve>
      ) : <p>Nenhum item pendente.</p>}
      <List>
        {items.map((item) => (
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
      <h2>Importar por links</h2>
      <form onSubmit={importUrls}>
        <TextArea value={urls} onChange={(event) => setUrls(event.target.value)} placeholder="Um link de álbum do Yupoo por linha" />
        <Button type="submit" $tone="ink">Importar links</Button>
      </form>
      <h2>Histórico</h2>
      <table>
        <thead>
          <tr><th>Data</th><th>Status</th><th>Encontrados</th><th>Novos</th><th>Duplicados</th><th>Alterações</th><th>Erros</th></tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td>{new Date(job.createdAt).toLocaleString('pt-BR')}</td>
              <td>{statusLabel[job.status] || job.status}</td>
              <td>{job.foundCount}</td>
              <td>{job.newCount}</td>
              <td>{job.duplicateSuspectCount}</td>
              <td>{job.changedCount}</td>
              <td>{job.errorCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const Actions = styled.div`display: flex; gap: 8px; flex-wrap: wrap;`;
const Approve = styled.div`display: flex; gap: 8px; flex-wrap: wrap; align-items: center; max-width: 520px; input { max-width: 240px; }`;
const Summary = styled.div`
  border: 1px solid ${({ theme }) => theme.line};
  padding: 12px;
  background: ${({ theme }) => theme.paperRaised};
  pre { white-space: pre-wrap; font-size: 12px; }
`;
const List = styled.ul`
  list-style: none; padding: 0;
  li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid ${({ theme }) => theme.line}; }
  small { display: block; color: ${({ theme }) => theme.muted}; }
`;
