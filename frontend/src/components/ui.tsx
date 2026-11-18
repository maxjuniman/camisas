import styled, { css } from 'styled-components';

export const Wrap = styled.div`
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
`;

export const Button = styled.button<{ $tone?: 'accent' | 'ink' | 'ghost' }>`
  border: 1px solid transparent;
  background: ${({ theme, $tone }) => ($tone === 'ghost' ? 'transparent' : $tone === 'ink' ? theme.ink : theme.accent)};
  color: ${({ theme, $tone }) => ($tone === 'ghost' ? theme.ink : theme.accentInk)};
  border-color: ${({ theme, $tone }) => ($tone === 'ghost' ? theme.ink : 'transparent')};
  padding: 12px 16px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
  &:hover:not(:disabled) { transform: translateY(-1px); }
`;

export const Field = styled.label`
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: ${({ theme }) => theme.muted};
`;

const control = css`
  width: 100%;
  background: ${({ theme }) => theme.paperRaised};
  border: 1px solid ${({ theme }) => theme.line};
  padding: 11px 12px;
  outline: none;
  &:focus { border-color: ${({ theme }) => theme.ink}; }
`;

export const Input = styled.input`${control}`;
export const Select = styled.select`${control}`;
export const TextArea = styled.textarea`
  ${control}
  min-height: 120px;
  resize: vertical;
`;

export const Notice = styled.p<{ $kind?: 'error' | 'ok' }>`
  margin: 0;
  padding: 10px 12px;
  background: ${({ $kind }) => ($kind === 'error' ? '#F8E4E1' : '#E5F3EB')};
  color: ${({ theme, $kind }) => ($kind === 'error' ? theme.accent : theme.good)};
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  @media (max-width: 980px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 640px) { grid-template-columns: 1fr; }
`;

export const SectionTitle = styled.h2`
  font-family: ${({ theme }) => theme.display};
  font-size: 42px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  line-height: 0.95;
`;
