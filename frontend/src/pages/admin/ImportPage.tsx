import { FormEvent, useEffect, useRef, useState } from 'react';
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
  removedCount: number;
  errorLog: string;
};

type Approval = {
  id: string;
  status: string;
  foundCount: number;
  cursor: number;
  approvedCount: number;
  skippedCount: number;
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

type SavedLink = { id: string; title: string; url: string };

type Issue = {
  id: string;
  rawName: string;
  displayName: string;
  matchStatus: string;
  reviewStatus: string;
  sourceUrl: string;
  rawDescription: string;
  image: { url: string | null; thumbUrl: string | null } | null;
  duplicates: { id: string; reason: string; score: number; product: { id: string; name: string; thumbUrl: string | null } }[];
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
  DISCONTINUED: 'Fora de fabricação',
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  IGNORED: 'Ignorado',
};

export function ImportPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [saved, setSaved] = useState<SavedLink[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftUrl, setDraftUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [analysisJob, setAnalysisJob] = useState<Job | null>(null);
  const [modal, setModal] = useState<'stop' | 'resume' | 'link' | 'analyze' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [price, setPrice] = useState('');
  const dialog = useDialog();
  const approvalSeen = useRef('');

  async function load() {
    const [jobRes, itemRes, approvalRes, linkRes] = await Promise.all([
      api.get<Job[]>('/admin/scraping/jobs'),
      api.get<Item[]>('/admin/scraping/items', { params: { reviewStatus: 'PENDING' } }),
      api.get<Approval[]>('/admin/scraping/approvals'),
      api.get<SavedLink[]>('/admin/scraping/links'),
    ]);
    setJobs(jobRes.data);
    setItems(itemRes.data);
    setApprovals(approvalRes.data);
    setSaved(linkRes.data);
  }

  useEffect(() => {
    void load().catch((reason: Error) => setError(reason.message));
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const job = approvals[0];
    if (!job) return;
    const previous = approvalSeen.current;
    const wasRunning = previous === `${job.id}:QUEUED` || previous === `${job.id}:RUNNING`;
    if (wasRunning && job.status === 'SUCCEEDED') {
      setMessage(`${job.approvedCount} produtos aprovados. ${job.skippedCount} ficaram para revisão.`);
    }
    if (wasRunning && job.status === 'FAILED') {
      setError('A aprovação foi interrompida.');
    }
    approvalSeen.current = `${job.id}:${job.status}`;
  }, [approvals]);

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
    const ready = items.filter((item) => item.matchStatus !== 'ERROR' && item.matchStatus !== 'DISCONTINUED');
    if (!ready.length) {
      await dialog.alert('Não há itens prontos para aprovar. Os erros e as peças fora de fabricação continuam na revisão.');
      return;
    }
    const confirmed = await dialog.confirm(
      'Aprovar os itens pendentes sem abrir a revisão? Possíveis duplicados também entram na fila. Os erros e as peças fora de fabricação continuam na revisão.',
    );
    if (!confirmed) return;
    setError('');
    setApproving(true);
    try {
      await api.post('/admin/scraping/approve', { price: parsed });
      setMessage('Aprovação iniciada.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao aprovar.');
    } finally {
      setApproving(false);
    }
  }

  async function dropFromCatalog(item: Item) {
    if (!(await dialog.confirm(`Tirar ${item.displayName || item.rawName} do catálogo? Essa peça não voltou no grupo.`))) return;
    try {
      await api.post(`/admin/scraping/items/${item.id}/discontinue`);
      setMessage('Peça retirada do catálogo. Parou de fabricar.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao retirar a peça.');
    }
  }

  async function keepSelling(item: Item) {
    try {
      await api.post(`/admin/scraping/items/${item.id}/review`, { action: 'ignore' });
      setMessage('Peça mantida no catálogo.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao manter a peça.');
    }
  }

  function openImport() {
    setEditingId(null);
    setDraftTitle('');
    setDraftUrl('');
    setModal('link');
  }

  function openSave(current: SavedLink) {
    setEditingId(current.id);
    setDraftTitle(current.title);
    setDraftUrl(current.url);
  }

  async function saveLink(event?: { preventDefault: () => void }) {
    event?.preventDefault();
    const title = draftTitle.trim();
    const url = draftUrl.trim();
    if (title.length < 2 || !url) {
      await dialog.alert('Informe o título e o link do grupo.');
      return;
    }
    try {
      if (editingId) await api.patch(`/admin/scraping/links/${editingId}`, { title, url });
      else await api.post('/admin/scraping/links', { title, url });
      setEditingId(null);
      setDraftTitle('');
      setDraftUrl('');
      setMessage(editingId ? 'Link atualizado.' : 'Link salvo.');
      await load();
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : 'Falha ao salvar o link.';
      setError(text);
      await dialog.alert(text);
    }
  }

  async function removeSaved(current: SavedLink) {
    if (!(await dialog.confirm(`Excluir o link ${current.title}?`))) return;
    try {
      await api.delete(`/admin/scraping/links/${current.id}`);
      setMessage('Link excluído.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao excluir o link.');
    }
  }

  async function importSaved(current: SavedLink) {
    try {
      await api.post('/admin/scraping/import', { url: current.url });
      setModal(null);
      setMessage(`Varredura de ${current.title} iniciada.`);
      await load();
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : 'Falha na importação.';
      setError(text);
      await dialog.alert(text);
    }
  }

  async function openAnalysis(job: Job) {
    try {
      const { data } = await api.get<Issue[]>(`/admin/scraping/jobs/${job.id}/issues`);
      setIssues(data);
      setAnalysisJob(job);
      setModal('analyze');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao abrir a análise.');
    }
  }

  async function decideDuplicate(issue: Issue, duplicate: boolean) {
    if (!analysisJob) return;
    try {
      if (duplicate) await api.post(`/admin/scraping/items/${issue.id}/review`, { action: 'ignore' });
      else await api.post(`/admin/scraping/items/${issue.id}/release`);
      setMessage(duplicate ? 'Marcada como duplicada. Não entra de novo no catálogo.' : 'Marcada como peça nova. Ela volta para a aprovação.');
      const { data } = await api.get<Issue[]>(`/admin/scraping/jobs/${analysisJob.id}/issues`);
      setIssues(data);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao analisar o duplicado.');
    }
  }

  async function importAnyway(issue: Issue) {
    if (!analysisJob) return;
    const parsed = price.trim() ? Number(price.replace(',', '.')) : 0;
    if (!Number.isFinite(parsed) || parsed < 0) {
      await dialog.alert('Informe um preço válido ou deixe o campo em branco.');
      return;
    }
    try {
      await api.post(`/admin/scraping/items/${issue.id}/import`, { price: parsed });
      setMessage(`${issue.displayName || issue.rawName} importada mesmo com a suspeita de duplicada.`);
      const { data } = await api.get<Issue[]>(`/admin/scraping/jobs/${analysisJob.id}/issues`);
      setIssues(data);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao importar a peça.');
    }
  }

  async function ignoreError(issue: Issue) {
    if (!analysisJob) return;
    try {
      await api.post(`/admin/scraping/items/${issue.id}/review`, { action: 'ignore' });
      setMessage('Erro ignorado.');
      const { data } = await api.get<Issue[]>(`/admin/scraping/jobs/${analysisJob.id}/issues`);
      setIssues(data);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao ignorar o erro.');
    }
  }

  async function importLink(event: FormEvent) {
    event.preventDefault();
    const url = draftUrl.trim();
    if (!url) {
      await dialog.alert('Informe o link do grupo.');
      return;
    }
    try {
      await api.post('/admin/scraping/import', { url });
      setModal(null);
      setMessage('Varredura do grupo iniciada. No fim, as peças que sumiram do fornecedor aparecem como fora de fabricação.');
      await load();
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : 'Falha na importação.';
      setError(text);
      await dialog.alert(text);
    }
  }

  const latest = jobs[0];
  const active = jobs.find((job) => job.status === 'RUNNING' || job.status === 'QUEUED' || job.status === 'PAUSED');
  const missingItems = items.filter((item) => item.matchStatus === 'DISCONTINUED');
  const catalogItems = items.filter((item) => item.matchStatus !== 'DISCONTINUED');
  const approvingJob = approvals.find((job) => job.status === 'RUNNING' || job.status === 'QUEUED');
  const approvalPercent = approvingJob?.foundCount
    ? Math.min(100, Math.round((approvingJob.cursor / approvingJob.foundCount) * 100))
    : 0;

  return (
    <section>
      <h1>Importação de produtos</h1>
      <Actions>
        <Button type="button" onClick={openImport} disabled={Boolean(active)}>Importar grupo</Button>
        {active && active.status !== 'PAUSED' ? (
          <Button type="button" $tone="ghost" onClick={() => setModal('stop')}>Parar</Button>
        ) : null}
        {active?.status === 'PAUSED' ? (
          <Button type="button" onClick={() => setModal('resume')}>Retomar</Button>
        ) : null}
        {active || items.length ? (
          <Button type="button" $tone="ghost" onClick={() => void reset()} disabled={resetting}>Zerar importação</Button>
        ) : null}
      </Actions>
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
        <Modal title="Importar grupo" onClose={() => setModal(null)}>
          <SavedList>
            {saved.length ? saved.map((current) => (
              <li key={current.id}>
                <div>
                  <strong>{current.title}</strong>
                  <small>{current.url}</small>
                </div>
                <span>
                  <button type="button" onClick={() => void importSaved(current)}>Importar</button>
                  <button type="button" onClick={() => openSave(current)}>Editar</button>
                  <button type="button" onClick={() => void removeSaved(current)}>Excluir</button>
                </span>
              </li>
            )) : <li>Nenhum link salvo.</li>}
          </SavedList>
          <form onSubmit={(event) => void importLink(event)}>
            <Field>
              Título
              <Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
            </Field>
            <Field>
              Link do grupo
              <Input value={draftUrl} onChange={(event) => setDraftUrl(event.target.value)} placeholder="" />
            </Field>
            <p>A varredura marca novo, duplicado e alteração. A peça que já está no catálogo e não voltar nesse grupo fica como fora de fabricação.</p>
            <Actions>
              <Button type="button" $tone="ghost" onClick={(event) => void saveLink(event)}>{editingId ? 'Atualizar link' : 'Salvar link'}</Button>
              <Button type="submit">Importar</Button>
            </Actions>
          </form>
        </Modal>
      ) : null}
      {modal === 'analyze' && analysisJob ? (
        <Modal title="Analisar detalhes" onClose={() => setModal(null)}>
          <Summary>
            {analysisJob.sourceUrl ? <p>Link: {analysisJob.sourceUrl}</p> : null}
            <p>Execução: {new Date(analysisJob.finishedAt || analysisJob.createdAt).toLocaleString('pt-BR')}</p>
            <p>Status: {statusLabel[analysisJob.status] || analysisJob.status}</p>
            <p>Progresso: {analysisJob.cursor} de {analysisJob.foundCount} · Novos: {analysisJob.newCount} · Existentes: {analysisJob.existingCount}</p>
            <p>Alterações: {analysisJob.changedCount} · Possíveis duplicados: {analysisJob.duplicateSuspectCount} · Fora de fabricação: {analysisJob.removedCount || 0} · Erros: {analysisJob.errorCount}</p>
            {analysisJob.errorLog ? <pre>{analysisJob.errorLog}</pre> : null}
          </Summary>
          {issues.length === 0 ? <p>Nenhum duplicado ou erro nesta varredura.</p> : null}
          <IssueList>
            {issues.map((issue) => (
              <li key={issue.id}>
                <IssueHead>
                  {issue.image?.url ? <img src={issue.image.thumbUrl || issue.image.url} alt="" /> : null}
                  <div>
                    <strong>{issue.displayName || issue.rawName}</strong>
                    <small>{issue.matchStatus === 'ERROR' ? 'Erro' : 'Possível duplicado'} · {issue.reviewStatus === 'PENDING' ? 'Pendente' : statusLabel[issue.reviewStatus] || issue.reviewStatus}</small>
                  </div>
                </IssueHead>
                {issue.matchStatus === 'ERROR' ? <p>Motivo: {issue.rawDescription || 'A leitura desta peça falhou.'}</p> : null}
                {issue.duplicates.map((candidate) => (
                  <p key={candidate.id}>
                    Parece a mesma peça que <strong>{candidate.product.name}</strong>, porque {duplicateReason(candidate.reason)} ({Math.round(candidate.score * 100)}%).
                  </p>
                ))}
                {issue.reviewStatus === 'PENDING' && issue.matchStatus === 'SUSPECT_DUPLICATE' ? (
                  <Actions>
                    <Button type="button" onClick={() => void decideDuplicate(issue, true)}>É duplicado</Button>
                    <Button type="button" $tone="ghost" onClick={() => void decideDuplicate(issue, false)}>Não é duplicado</Button>
                    <Button type="button" $tone="ink" onClick={() => void importAnyway(issue)}>Importar mesmo assim</Button>
                  </Actions>
                ) : null}
                {issue.reviewStatus === 'PENDING' && issue.matchStatus === 'ERROR' ? (
                  <Actions>
                    <a href={issue.sourceUrl} target="_blank" rel="noreferrer">Abrir no fornecedor</a>
                    <Button type="button" $tone="ghost" onClick={() => void ignoreError(issue)}>Ignorar</Button>
                  </Actions>
                ) : null}
              </li>
            ))}
          </IssueList>
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
      {approvingJob ? (
        <Progress>
          <p>{approvingJob.foundCount ? `Aprovando ${approvingJob.cursor} de ${approvingJob.foundCount}` : 'Preparando a aprovação'}</p>
          <Track>
            <Fill style={{ width: approvingJob.foundCount ? `${approvalPercent}%` : undefined }} $busy={!approvingJob.foundCount} />
          </Track>
          <strong>{approvingJob.foundCount ? `${approvalPercent}%` : '…'}</strong>
        </Progress>
      ) : null}
      {!active && !approvingJob && (catalogItems.length || missingItems.length) ? (
        <>
          {missingItems.length ? (
            <>
              <h2>Fora de fabricação</h2>
              <p>Estas peças estão no catálogo e não voltaram neste grupo.</p>
              {groupItems(missingItems).map(([team, group]) => (
                <div key={`missing-${team}`}>
                  {team !== 'Sem time' ? <TeamName>{team}</TeamName> : null}
                  <List>
                    {group.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.displayName || item.rawName}</strong>
                          <small>Fora de fabricação</small>
                        </div>
                        <span>
                          <button type="button" onClick={() => void dropFromCatalog(item)}>Tirar do catálogo</button>
                          <button type="button" onClick={() => void keepSelling(item)}>Manter</button>
                        </span>
                      </li>
                    ))}
                  </List>
                </div>
              ))}
            </>
          ) : null}
          {catalogItems.length ? (
            <>
              <h2>Pendentes de aprovação</h2>
              {catalogItems.some((item) => item.matchStatus !== 'ERROR') ? (
                <Approve>
                  <Input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Preço de todos, se quiser" inputMode="decimal" />
                  <Button type="button" onClick={() => void approveAll()} disabled={approving}>Aprovar sem revisar</Button>
                </Approve>
              ) : null}
              {groupItems(catalogItems).map(([team, group]) => (
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
                        <Link to={`/admin/importacao/itens/${item.id}`}>{item.matchStatus === 'ERROR' || item.matchStatus === 'SUSPECT_DUPLICATE' ? 'Analisar' : 'Revisar'}</Link>
                      </li>
                    ))}
                  </List>
                </div>
              ))}
            </>
          ) : null}
        </>
      ) : !active && !approvingJob ? (
        <p>{latest && latest.newCount === 0 && !latest.removedCount ? 'Nada novo nesta varredura.' : 'Nenhum item pendente.'}</p>
      ) : null}
      <h2>Histórico</h2>
      {jobs.length ? (
        <table>
          <thead>
            <tr><th>Data</th><th>Status</th><th>Encontrados</th><th>Novos</th><th>Duplicados</th><th>Alterações</th><th>Fora</th><th>Erros</th><th></th></tr>
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
                  <td>{job.removedCount || 0}</td>
                  <td>{job.errorCount}</td>
                  <td>
                    <Button type="button" $tone="ghost" onClick={() => void openAnalysis(job)}>Analisar detalhes</Button>
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      ) : <p>Nenhuma varredura executada.</p>}
    </section>
  );
}

function duplicateReason(reason: string) {
  if (reason === 'IMAGE') return 'a foto é parecida';
  if (reason === 'BOTH') return 'o nome e a foto são parecidos';
  return 'o nome é parecido';
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
const Summary = styled.div`
  border: 1px solid ${({ theme }) => theme.line};
  padding: 12px;
  background: ${({ theme }) => theme.paper};
  p { margin: 0 0 6px; overflow-wrap: anywhere; }
  pre { white-space: pre-wrap; font-size: 12px; margin: 0; }
`;
const SavedList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 220px;
  overflow: auto;
  li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid ${({ theme }) => theme.line}; }
  small { display: block; color: ${({ theme }) => theme.muted}; overflow-wrap: anywhere; }
  button { margin-left: 12px; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; font: inherit; }
  button:disabled { cursor: default; opacity: 0.45; }
`;
const IssueList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
  li { padding: 12px 0; border-bottom: 1px solid ${({ theme }) => theme.line}; }
  p { margin: 8px 0; }
  a { margin-right: 12px; }
`;
const IssueHead = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  img { width: 48px; height: 48px; object-fit: cover; }
  small { display: block; color: ${({ theme }) => theme.muted}; }
`;
const List = styled.ul`
  list-style: none; padding: 0;
  li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid ${({ theme }) => theme.line}; }
  button { margin-left: 12px; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; font: inherit; }
  small { display: block; color: ${({ theme }) => theme.muted}; }
`;
