# DataPulse Analytics — Frontend

Frontend do DataPulse Analytics (Especificação Técnica v2, §3.1): upload retomável de
CSV de até 1 GiB direto ao MinIO, progresso em tempo real por SSE, anomalias e
dashboards por empresa (tenant).

Monorepo pnpm com três pacotes:

| Pacote | O que é |
|---|---|
| `apps/web` | Next.js 16 (App Router), TypeScript strict, Tailwind v4, TanStack Query, ECharts |
| `libs/contracts` | Schemas zod dos endpoints (§8) e dos eventos (§9); fonte única dos tipos |
| `libs/csv-rules` | Dialeto, cabeçalho e regras por coluna do CSV (§5), iguais aos do backend |

## Como rodar

Requisitos: Node 24 (`.nvmrc`) e pnpm 12.

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Em dev o Next repassa `/api/v1/*` para a API (`localhost:3001`) e `/sse/v1/*` para o
serviço realtime (`localhost:3002`), imitando o ingress de produção. As origens ficam em
`apps/web/.env.example`.

| Script (na raiz) | Faz |
|---|---|
| `pnpm dev` | Sobe o app web |
| `pnpm build` | Build de todos os pacotes |
| `pnpm test` | Testes (vitest) de libs e app |
| `pnpm typecheck` | `tsc --noEmit` em todos os pacotes |
| `pnpm lint` | ESLint |

## Rotas

| Rota | Tela |
|---|---|
| `/login`, `/signup`, `/invite?token=` | Autenticação e aceite de convite |
| `/batches` | Histórico, com filtros na URL e progresso ao vivo |
| `/batches/new` | Upload com arrastar e soltar e retomada |
| `/batches/[id]` | Status, progresso, anomalias, retry, exclusão e dashboard do lote |
| `/dashboard` | Dashboard consolidado do tenant |
| `/settings/users` | Convites e papéis (só admin) |

## Estrutura de `apps/web/src`

```
app/            rotas; (public) sem sessão, (app) com guarda de sessão e SSE
providers/      QueryProvider, SessionProvider, RealtimeProvider
lib/api/        apiFetch, ApiError, token em memória, query keys
lib/realtime/   cliente SSE com ticket de uso único e backoff
features/       auth, batches, upload (com o Web Worker), dashboard, users
components/     UI genérica e o wrapper do ECharts
```

## Decisões de engenharia

**Nenhum dado de tenant no servidor do Next (ADR 18).** As páginas são shells; tudo vem
da API no navegador via TanStack Query. O `QueryClient` é criado por montagem
(`useState`), nunca no escopo do módulo, para não virar cache compartilhado entre
requisições no servidor.

**Sessão.** O access token vive só em memória e é renovado 60 s antes de expirar. O
refresh token é rotacionado e o reuso revoga a família (§11.2), então duas renovações
concorrentes derrubariam a sessão: na mesma aba elas compartilham uma promise, e entre
abas a Web Locks API serializa o refresh.

**Sem `proxy.ts`/middleware de sessão.** A spec sugere redirecionar para `/login` quando
falta o cookie `dp_rt`, mas o cookie tem `Path=/api/v1/auth` e o navegador não o envia
nas rotas de página, então o servidor do Next nunca o veria. A guarda fica no layout
de `(app)`, no cliente. Isso é só UX; a segurança é o Bearer em cada chamada.

**Tempo real.** Um `EventSource` por aba. Como o ticket é de uso único, o cliente fecha
no primeiro erro, pede ticket novo e reabre com `last_event_id` (backoff 1/2/5/10 s).
Cada evento corrige o cache do lote e das listas; eventos mais antigos que o último
aplicado ou que o `as_of` do snapshot são descartados (§9.3). Sem SSE, telas com lote
ativo caem para polling de 5 s.

**Upload.** O Web Worker inspeciona os primeiros 64 KiB com `libs/csv-rules`, calcula o
SHA-256 em blocos de 8 MiB (hash-wasm) e envia as partes ao MinIO, 4 em paralelo, com até
5 tentativas por parte e renovação de URL em 403. A página orquestra a API; o worker
nunca vê o token. A retomada guarda `batch_id` e partes no IndexedDB, mas quem manda é
`GET /upload/parts`: ao escolher o mesmo arquivo de novo, só sobem as partes que faltam.

**Webpack em vez de Turbopack.** No Next 16.3 o Turbopack emitia o `upload.worker.ts` cru
(como asset) em vez de compilá-lo, e o upload quebrava no navegador. `dev` e `build`
usam `--webpack` até isso ser resolvido.

**`compress: false` quando há rewrite de SSE.** A compressão gzip do servidor do Next
bufferiza respostas em stream, e o `EventSource` (que aceita gzip) não recebia nenhum
evento. Em produção o ingress entrega `/sse` direto ao serviço realtime.

**CSP (§11.3)** só em produção: `connect-src` libera o app e o storage;
`'wasm-unsafe-eval'` é para o hash-wasm; `'unsafe-inline'` em scripts é exigido pelo
bootstrap do Next sem nonce.

**Gráficos.** Um eixo por gráfico (volume e quantidade alternam, nunca dois eixos y),
barras horizontais identificadas pelo rótulo e não pela cor, tooltips com escape de
HTML. A paleta categórica em `globals.css` passou no validador de daltonismo nos modos
claro e escuro.

## Pontos em aberto com o backend

- Erros: a spec pede RFC 7807; hoje a API responde `{ code, message }`. O cliente aceita
  os dois formatos.
- O link de convite do §8.2 cita `/{locale}/invite`; o app usa `/invite`, sem prefixo de
  idioma, como na lista de rotas do §3.1.
- Recomendado no serviço realtime: `Cache-Control: no-cache, no-transform`, para
  nenhum proxy comprimir o stream.
- O CORS do MinIO precisa expor o header `ETag`; sem ele o upload falha com uma
  mensagem explícita.

## Licença

[MIT](LICENSE)
