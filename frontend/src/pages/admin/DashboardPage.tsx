import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { storeConfig } from '../../config/store';
import { api } from '../../services/api';

type Summary = {
  total: number;
  active: number;
  inactive: number;
  pendingApproval: number;
  lastScanFound: number;
  lastScanAt: string | null;
  lastScanNew: number;
  lastScanStatus: string | null;
};

export function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = `Painel · ${storeConfig.name}`;
    api.get<Summary>('/admin/dashboard').then((response) => setData(response.data)).catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <p>{error}</p>;
  if (!data) return <p>Carregando...</p>;

  const cards = [
    ['Produtos cadastrados', data.total],
    ['Ativos', data.active],
    ['Desabilitados', data.inactive],
    ['Pendentes de aprovação', data.pendingApproval],
    ['Encontrados na última varredura', data.lastScanFound],
    ['Novos na última varredura', data.lastScanNew],
  ];

  return (
    <section>
      <h1>Painel</h1>
      <Cards>
        {cards.map(([label, value]) => (
          <article key={String(label)}>
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </Cards>
      <p>Última execução: {data.lastScanAt ? new Date(data.lastScanAt).toLocaleString('pt-BR') : 'ainda não houve'} {data.lastScanStatus ? `· ${scanStatus[data.lastScanStatus] || data.lastScanStatus}` : ''}</p>
    </section>
  );
}

const scanStatus: Record<string, string> = {
  QUEUED: 'Na fila',
  RUNNING: 'Em execução',
  PAUSED: 'Pausada',
  SUCCEEDED: 'Concluída',
  FAILED: 'Falhou',
};

const Cards = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0;
  article { border: 1px solid ${({ theme }) => theme.line}; padding: 16px; background: ${({ theme }) => theme.paperRaised}; }
  strong { display: block; font-family: ${({ theme }) => theme.display}; font-size: 42px; line-height: 1; }
  span { color: ${({ theme }) => theme.muted}; font-size: 14px; }
  @media (max-width: 800px) { grid-template-columns: 1fr; }
`;
