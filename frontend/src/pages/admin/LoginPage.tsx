import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Button, Field, Input, Notice } from '../../components/ui';
import logo from '../../img/logo.jpeg';
import { storeConfig } from '../../config/store';
import { api } from '../../services/api';
import { useAuth } from '../../auth/AuthContext';

export function LoginPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (user) return <Navigate to="/admin" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api.post('/auth/login', { email, password });
      await refresh();
      navigate('/admin');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha no login.');
    }
  }

  return (
    <Screen>
      <form onSubmit={submit}>
        <img src={logo} alt={storeConfig.name} />
        <h1>Entrar no painel</h1>
        <Field>E-mail<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
        <Field>Senha<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></Field>
        {error ? <Notice $kind="error">{error}</Notice> : null}
        <Button type="submit">Entrar</Button>
      </form>
    </Screen>
  );
}

const Screen = styled.main`
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme.ink};
  color: ${({ theme }) => theme.paper};
  form { width: min(420px, calc(100% - 32px)); display: grid; gap: 14px; }
  form label { color: #D6DEE8; }
  h1 { font-family: ${({ theme }) => theme.display}; font-size: 56px; text-transform: uppercase; line-height: 0.9; }
  img { width: 180px; background: ${({ theme }) => theme.white}; }
  input { background: transparent; color: ${({ theme }) => theme.paper}; }
`;
