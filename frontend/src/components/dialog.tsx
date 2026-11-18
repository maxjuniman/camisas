import { FormEvent, ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Button, Input } from './ui';

type AlertRequest = { kind: 'alert'; message: string; resolve: () => void };
type ConfirmRequest = { kind: 'confirm'; message: string; resolve: (value: boolean) => void };
type PromptRequest = { kind: 'prompt'; message: string; defaultValue: string; resolve: (value: string | null) => void };
type DialogRequest = AlertRequest | ConfirmRequest | PromptRequest;

type DialogApi = {
  alert: (message: string) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
  prompt: (message: string, defaultValue?: string) => Promise<string | null>;
};

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog() {
  const dialog = useContext(DialogContext);
  if (!dialog) throw new Error('O modal de aviso não está disponível.');
  return dialog;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const queue = useRef<DialogRequest[]>([]);
  const [current, setCurrent] = useState<DialogRequest | null>(null);
  const [draft, setDraft] = useState('');

  function show(request: DialogRequest) {
    queue.current.push(request);
    setCurrent((shown) => shown ?? queue.current[0] ?? null);
    if (request.kind === 'prompt') setDraft(request.defaultValue);
  }

  const finish = useCallback((value?: boolean | string | null) => {
    const active = queue.current.shift();
    if (active?.kind === 'alert') active.resolve();
    if (active?.kind === 'confirm') active.resolve(value === true);
    if (active?.kind === 'prompt') active.resolve(typeof value === 'string' ? value : null);
    const next = queue.current[0] ?? null;
    setCurrent(next);
    setDraft(next?.kind === 'prompt' ? next.defaultValue : '');
  }, []);

  const api: DialogApi = {
    alert: (message) => new Promise((resolve) => show({ kind: 'alert', message, resolve })),
    confirm: (message) => new Promise((resolve) => show({ kind: 'confirm', message, resolve })),
    prompt: (message, defaultValue = '') => new Promise((resolve) => show({ kind: 'prompt', message, defaultValue, resolve })),
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      {current ? <DialogView request={current} draft={draft} setDraft={setDraft} onFinish={finish} /> : null}
    </DialogContext.Provider>
  );
}

function DialogView({
  request,
  draft,
  setDraft,
  onFinish,
}: {
  request: DialogRequest;
  draft: string;
  setDraft: (value: string) => void;
  onFinish: (value?: boolean | string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    inputRef.current?.select();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onFinish(request.kind === 'alert' ? undefined : request.kind === 'confirm' ? false : null);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [request, onFinish]);

  function submitPrompt(event: FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    onFinish(value || null);
  }

  const title = request.kind === 'alert' ? 'Aviso' : request.kind === 'confirm' ? 'Confirmar' : request.message;

  return (
    <Backdrop onMouseDown={() => onFinish(request.kind === 'confirm' ? false : request.kind === 'prompt' ? null : undefined)}>
      <Panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <Title id="dialog-title">{title}</Title>
        {request.kind !== 'prompt' ? <Message>{request.message}</Message> : null}
        {request.kind === 'prompt' ? (
          <form onSubmit={submitPrompt}>
            <Input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} aria-label={request.message} />
            <Actions>
              <Button type="button" $tone="ghost" onClick={() => onFinish(null)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </Actions>
          </form>
        ) : (
          <Actions>
            {request.kind === 'confirm' ? <Button type="button" $tone="ghost" onClick={() => onFinish(false)}>Cancelar</Button> : null}
            <Button type="button" autoFocus onClick={() => onFinish(request.kind === 'confirm' ? true : undefined)}>
              {request.kind === 'confirm' ? 'Confirmar' : 'Entendi'}
            </Button>
          </Actions>
        )}
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
  width: min(480px, 100%);
  background: ${({ theme }) => theme.paperRaised};
  border: 1px solid ${({ theme }) => theme.line};
  padding: 24px;
  display: grid;
  gap: 16px;
  form { display: grid; gap: 16px; }
`;

const Title = styled.h2`
  margin: 0;
  font-family: ${({ theme }) => theme.display};
  font-size: 36px;
  line-height: 0.95;
  text-transform: uppercase;
`;

const Message = styled.p`
  margin: 0;
  line-height: 1.5;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
`;
