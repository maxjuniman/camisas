# Camisas

Loja de camisas esportivas. O cliente vê o catálogo e faz a encomenda pelo WhatsApp. O pagamento, o carrinho e o checkout ficam para uma versão futura. O painel administrativo cadastra produtos, organiza times, esportes, categorias, tamanhos e temporadas, e importa álbuns do fornecedor Yupoo para revisão manual.

## Requisitos

- Docker e Docker Compose, para o jeito recomendado de subir tudo.
- Node.js 22, só se for rodar a API e o site fora do Docker.

## Subir localmente

Na raiz do projeto:

```bash
cp .env.example .env
docker compose up --build
```

O Compose sobe o Postgres, a API e o site juntos. O backend não precisa ser iniciado antes. Abra `http://localhost:8090`.

O primeiro acesso cria o administrador com `ADMIN_EMAIL` e `ADMIN_PASSWORD` do `.env`. Troque esses valores antes de usar o sistema de verdade. O número de WhatsApp fica só em `frontend/src/config/store.ts`. Depois de alterá-lo, gere o site de novo com `docker compose up --build`.

## Sem Docker

```bash
cd backend
cp ../.env.example .env
# ajuste DATABASE_URL para um Postgres local
npx prisma migrate deploy
npm run build
npm start
```

```bash
cd frontend
npm run dev
```

O Vite publica o site em `http://localhost:5173` e encaminha `/api` e `/media` para a API na porta 3000. Nesse modo a API precisa estar no ar.

## Painel

- Login: `/admin/login`
- Produtos, cadastros e importação ficam no menu depois da entrada.
- A varredura lê a categoria pública do Yupoo configurada em `YUPOO_CATEGORY_URL`. O padrão atual é o grupo menor do Grêmio.
- Em Importação, "Zerar importação" apaga a fila e os itens ainda não publicados. Produtos já aprovados permanecem.
- Na revisão, "Nome no site" é o texto que aparece no catálogo público. O nome do fornecedor fica só como referência.
- Se o fornecedor bloquear a leitura, cole os links dos álbuns na mesma tela. Nada é publicado sem aprovação.
- Preço, time, categoria, tamanhos e disponibilidade da loja não são substituídos sozinhos por uma nova coleta.

## Produção

O `docker-compose.yml` publica o site na porta 8090. A API fica na rede interna do Compose. Imagens ficam no volume `media`.

Neste servidor o endereço `http://167.233.239.13` já aponta para outro site. Esta loja fica em `http://167.233.239.13:8090` para não interromper o que já está publicado.

## Atualizar

```bash
git pull
docker compose up --build -d
```
