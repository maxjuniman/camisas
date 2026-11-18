import { ReactNode, useEffect } from 'react';
import styled from 'styled-components';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <Backdrop onMouseDown={onClose}>
      <Panel role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <Title id="modal-title">{title}</Title>
        {children}
      </Panel>
    </Backdrop>
  );
}

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(18, 20, 24, 0.62);
`;

const Panel = styled.div`
  width: min(560px, 100%);
  background: ${({ theme }) => theme.paperRaised};
  border: 1px solid ${({ theme }) => theme.line};
  padding: 24px;
  display: grid;
  gap: 16px;
  form { display: grid; gap: 16px; }
  p { margin: 0; line-height: 1.5; }
`;

const Title = styled.h2`
  margin: 0;
  font-family: ${({ theme }) => theme.display};
  font-size: 36px;
  line-height: 0.95;
  text-transform: uppercase;
`;
