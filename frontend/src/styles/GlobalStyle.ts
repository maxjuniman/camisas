import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  * { box-sizing: border-box; }
  html, body, #root { margin: 0; min-height: 100%; }
  body {
    background: ${({ theme }) => theme.paper};
    color: ${({ theme }) => theme.text};
    font-family: ${({ theme }) => theme.body};
    font-size: 16px;
    line-height: 1.5;
  }
  a { color: inherit; text-decoration: none; }
  button, input, select, textarea { font: inherit; color: inherit; }
  img { max-width: 100%; display: block; }
  h1, h2, h3, p { margin: 0; }
`;
