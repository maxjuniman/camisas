import { FormEvent, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { storeConfig } from '../config/store';
import { contactLink } from '../services/whatsapp';
import { Wrap } from './ui';

export function PublicLayout() {
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
}

function Header() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  function search(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    navigate(`/catalogo?${params.toString()}`);
    setOpen(false);
  }

  return (
    <Bar>
      <Wrap>
        <Row>
          <Brand to="/">{storeConfig.name}</Brand>
          <Nav $open={open}>
            <NavLink to="/catalogo">Catálogo</NavLink>
            <NavLink to="/catalogo?sports=futebol">Futebol</NavLink>
            <NavLink to="/catalogo?sports=basquete">Basquete</NavLink>
            <a href={contactLink()} target="_blank" rel="noreferrer">WhatsApp</a>
          </Nav>
          <Search onSubmit={search}>
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Buscar camisa ou time"
              aria-label="Buscar produtos"
            />
          </Search>
          <Menu type="button" onClick={() => setOpen((value) => !value)} aria-label="Abrir menu">
            Menu
          </Menu>
        </Row>
      </Wrap>
    </Bar>
  );
}

function Footer() {
  return (
    <Foot>
      <Wrap>
        <FootGrid>
          <div>
            <Brand to="/">{storeConfig.name}</Brand>
            <p>Encomendas de camisas esportivas pelo WhatsApp. Sem carrinho e sem pagamento no site.</p>
          </div>
          <div>
            <strong>Navegação</strong>
            <Link to="/catalogo">Catálogo</Link>
            <Link to="/admin/login">Área da loja</Link>
            <a href={contactLink()} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
          </div>
        </FootGrid>
      </Wrap>
    </Foot>
  );
}

const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 10;
  background: ${({ theme }) => theme.paper};
  border-bottom: 1px solid ${({ theme }) => theme.line};
  &::before {
    content: '';
    display: block;
    height: 4px;
    background: ${({ theme }) => theme.accent};
  }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 22px;
  min-height: 72px;
`;

const Brand = styled(Link)`
  font-family: ${({ theme }) => theme.display};
  font-size: 32px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
`;

const Nav = styled.nav<{ $open: boolean }>`
  display: flex;
  gap: 18px;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  a.active { color: ${({ theme }) => theme.accent}; }
  @media (max-width: 860px) {
    display: ${({ $open }) => ($open ? 'flex' : 'none')};
    position: absolute;
    top: 76px;
    left: 0;
    right: 0;
    flex-direction: column;
    padding: 16px;
    background: ${({ theme }) => theme.paper};
    border-bottom: 1px solid ${({ theme }) => theme.line};
  }
`;

const Search = styled.form`
  margin-left: auto;
  input {
    width: min(280px, 36vw);
    border: 0;
    border-bottom: 1px solid ${({ theme }) => theme.ink};
    background: transparent;
    padding: 8px 0;
    outline: none;
  }
  @media (max-width: 860px) { display: none; }
`;

const Menu = styled.button`
  display: none;
  margin-left: auto;
  background: none;
  border: 1px solid ${({ theme }) => theme.ink};
  padding: 8px 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  @media (max-width: 860px) { display: inline-flex; }
`;

const Foot = styled.footer`
  margin-top: 72px;
  background: ${({ theme }) => theme.ink};
  color: ${({ theme }) => theme.paper};
  padding: 48px 0;
  a { display: block; color: ${({ theme }) => theme.paper}; margin-top: 8px; }
  p { max-width: 360px; color: #d9d0c4; }
`;

const FootGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
  @media (max-width: 720px) { grid-template-columns: 1fr; }
`;
