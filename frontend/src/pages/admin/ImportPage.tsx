import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { Button, Notice, TextArea } from '../../components/ui';
import { api } from '../../services/api';

type Job = {
  id: string;
  status: string;
  forced: boolean;
  createdAt: string;
  finishedAt: string | null;
  foundCount: number;
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
  matchStatus: string;
  reviewStatus: string;
  sourceUrl: string;
};

const statusLabel: Record<string, string> = {
  QUEUED: 'Na fila',
  RUNNING: 'Em execução',
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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [jobRes, itemRes] = await Promise.all([
      api.get<Job[]>('/admin/scraping/jobs'),
      api.get<Item[]>('/admin/scraping/items', { params: { reviewStatus: 'PENDING' } }),
    ]);
    setJobs(jobRes.data);
    setItems(itemRes.data);
  }

  useEffect(() => {
    void load().catch((reason: Error) => setError(reason.message));
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

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

  return (
    <section>
      <h1>Importação de produtos</h1>
      <Actions>
        <Button type="button" onClick={() => void start(false)}>Iniciar varredura</Button>
        <Button type="button" $tone="ink" onClick={() => void start(true)}>Forçar nova varredura</Button>
      </Actions>
      {latest ? (
        <Summary>
          <p>Última execução: {new Date(latest.finishedAt || latest.createdAt).toLocaleString('pt-BR')}</p>
          <p>Status: {statusLabel[latest.status] || latest.status}</p>
          <p>Encontrados: {latest.foundCount} · Novos: {latest.newCount} · Existentes: {latest.existingCount}</p>
          <p>Alterações: {latest.changedCount} · Possíveis duplicados: {latest.duplicateSuspectCount} · Erros: {latest.errorCount}</p>
          {latest.errorLog ? <pre>{latest.errorLog}</pre> : null}
        </Summary>
      ) : <p>Nenhuma varredura executada.</p>}
      {message ? <Notice $kind="ok">{message}</Notice> : null}
      {error ? <Notice $kind="error">{error}</Notice> : null}
      <h2>Pendentes de aprovação</h2>
      <List>
        {items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.rawName}</strong>
              <small>{statusLabel[item.matchStatus] || item.matchStatus}</small>
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
