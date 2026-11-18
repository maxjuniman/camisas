import { NavLink, Navigate, Outlet } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../auth/AuthContext';

const links = [
  ['/admin', 'Painel'],
  ['/admin/produtos', 'Produtos'],
  ['/admin/taxonomias', 'Cadastros'],
  ['/admin/importacao', 'Importação'],
];

export function AdminLayout() {
  const { user, ready, logout } = useAuth();
  if (!ready) return <p>Carregando sessão...</p>;
  if (!user) return <Navigate to="/admin/login" replace />;

  return (
    <Shell>
      <Side>
        <strong>Loja</strong>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/admin'}>{label}</NavLink>
        ))}
        <button type="button" onClick={() => void logout()}>Sair</button>
      </Side>
      <Content>
        <Outlet />
      </Content>
    </Shell>
  );
}

const Shell = styled.div`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 220px 1fr;
  @media (max-width: 800px) { grid-template-columns: 1fr; }
`;
const Side = styled.aside`
  background: ${({ theme }) => theme.ink};
  color: ${({ theme }) => theme.paper};
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  strong { font-family: ${({ theme }) => theme.display}; font-size: 32px; letter-spacing: 0.08em; text-transform: uppercase; }
  a { color: #d9d0c4; }
  a.active { color: white; }
  button { margin-top: auto; background: none; border: 1px solid #d9d0c4; color: white; padding: 8px; cursor: pointer; }
  @media (max-width: 800px) { button { margin-top: 0; } }
`;
const Content = styled.main`
  padding: 28px;
  display: grid;
  align-content: start;
  gap: 18px;
  h1 { font-family: ${({ theme }) => theme.display}; font-size: 48px; line-height: 0.9; text-transform: uppercase; }
  h2 { font-family: ${({ theme }) => theme.display}; font-size: 28px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; background: ${({ theme }) => theme.paperRaised}; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid ${({ theme }) => theme.line}; }
  form { display: grid; gap: 10px; max-width: 720px; }
`;
