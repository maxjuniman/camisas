import { FormEvent, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import logo from '../img/logo.jpeg';
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
          <Brand to="/" aria-label={storeConfig.name}>
            <img src={logo} alt="" />
          </Brand>
          <Nav $open={open}>
            <NavLink to="/catalogo">Catálogo</NavLink>
            <NavLink to="/catalogo?ready=1">Pronta entrega</NavLink>
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
            <FooterMark to="/">{storeConfig.name}</FooterMark>
            <p>Futebol, NBA e NFL. Encomendas pelo WhatsApp, sem carrinho e sem pagamento no site.</p>
          </div>
          <div>
            <strong>Navegação</strong>
            <Link to="/catalogo">Catálogo</Link>
            <Link to="/catalogo?ready=1">Pronta entrega</Link>
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
  background: ${({ theme }) => theme.white};
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
  display: flex;
  align-items: center;
  img { height: 96px; width: auto; }
`;

const FooterMark = styled(Link)`
  font-family: ${({ theme }) => theme.display};
  font-size: 32px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
  color: ${({ theme }) => theme.accent};
`;

const Nav = styled.nav<{ $open: boolean }>`
  display: flex;
  gap: 18px;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
  a.active { color: ${({ theme }) => theme.ink}; box-shadow: inset 0 -2px 0 ${({ theme }) => theme.accent}; }
  @media (max-width: 860px) {
    display: ${({ $open }) => ($open ? 'flex' : 'none')};
    position: absolute;
    top: 84px;
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
  p { max-width: 360px; color: #D6DEE8; }
`;

const FootGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
  @media (max-width: 720px) { grid-template-columns: 1fr; }
`;
