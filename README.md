# MCP Incident Orchestrator

**Um servidor MCP (Model Context Protocol) que unifica Sentry, Datadog, Microsoft Clarity e AWS CloudWatch Logs por trás de uma única interface de ferramentas — consumido tanto por um dashboard web quanto por qualquer cliente MCP (Cursor, Claude Desktop, etc).**

🇧🇷 [Português](#-português) · 🇺🇸 [English](#-english)

---

## 🇧🇷 Português

### Índice

- [A ideia](#a-ideia)
- [O problema que resolve](#o-problema-que-resolve)
- [Por que essa arquitetura](#por-que-essa-arquitetura)
- [Visão geral da arquitetura](#visão-geral-da-arquitetura)
- [Stack técnica](#stack-técnica)
- [Estrutura do monorepo](#estrutura-do-monorepo)
- [O servidor MCP em detalhe](#o-servidor-mcp-em-detalhe)
- [O dashboard em detalhe](#o-dashboard-em-detalhe)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Decisões técnicas notáveis](#decisões-técnicas-notáveis)
- [Limitações conhecidas e roadmap](#limitações-conhecidas-e-roadmap)

---

### A ideia

Times de engenharia raramente têm **um** lugar para entender "o que está acontecendo com a aplicação agora". Os erros de frontend estão no Sentry, os logs de backend estão no Datadog (ou CloudWatch), o comportamento real do usuário (rage clicks, dead clicks, sessões) está no Microsoft Clarity — e para responder uma pergunta simples como *"os erros de hoje na tela de agendamento têm relação com o pico de rage clicks que vi no Clarity?"* alguém precisa abrir três ferramentas diferentes, em três abas diferentes, e cruzar os dados manualmente na cabeça.

Este projeto parte de uma pergunta de arquitetura: **e se, em vez de construir um dashboard que faz integração direta com cada API (Sentry SDK aqui, Datadog SDK ali), a camada de acesso a dados fosse um servidor MCP — o mesmo protocolo que ferramentas de IA como Claude e Cursor usam para chamar ferramentas externas?**

Na prática isso significa que:
- O **mesmo código** que busca "erros não resolvidos no Sentry" pode ser chamado por um assistente de IA dentro do Cursor (via stdio), por um chat com Gemini dentro do próprio dashboard (via HTTP), ou por uma página Next.js server-side (também via HTTP) — sem duplicar lógica de integração em três lugares.
- Adicionar uma nova fonte de dados (ex: AWS CloudWatch Logs, adicionado depois dos três iniciais) significa escrever um novo plugin que segue o mesmo contrato — não reinventar a arquitetura.
- A "inteligência" de decidir *quais* dados buscar para responder uma pergunta em linguagem natural ("o que aconteceu ontem à tarde?") fica a cargo do LLM, que já sabe fazer *function calling* — o servidor só precisa expor ferramentas bem definidas e documentadas.

### O problema que resolve

1. **Fragmentação de observabilidade.** Erros, logs e comportamento do usuário vivem em ferramentas separadas, cada uma com sua própria UI, sua própria linguagem de busca e seu próprio modelo de dados.
2. **Repetição de lógica de integração.** Sem uma camada MCP, cada consumidor (dashboard, chatbot, script de automação) precisaria reimplementar autenticação, paginação e parsing para cada API externa.
3. **Fadiga de contexto ao investigar incidentes.** Entender a causa raiz de um erro geralmente exige contexto (navegador, SO, geolocalização, breadcrumbs, requisição HTTP) que fica espalhado em abas diferentes da própria ferramenta de origem.
4. **Falta de histórico consolidado.** "O que mudou desde ontem?" é uma pergunta que nenhuma dessas ferramentas responde sozinha — é preciso alguém (ou algo) rodando um resumo diário e guardando isso em algum lugar consultável.
5. **Cotas de API apertadas.** Ferramentas como o Clarity impõem limites duros (10 requisições/dia por projeto) — uma arquitetura ingênua que bate na API a cada pergunta do usuário estoura a cota em poucas horas de uso.

### Por que essa arquitetura

A decisão central do projeto foi tratar o **MCP como a camada de domínio**, não como um apêndice de IA:

```
                     ┌─────────────────────────────┐
                     │      MCP Server (Node)       │
                     │  stdio  +  Streamable HTTP    │
                     │                               │
                     │  Plugins (1 por fonte):       │
                     │   • Sentry                    │
                     │   • Datadog                    │
                     │   • Microsoft Clarity          │
                     │   • AWS CloudWatch Logs        │
                     │                               │
                     │  4 tools por plugin:           │
                     │   capture / count / summarize / │
                     │   details                      │
                     └───────────┬───────────────────┘
                                 │
             ┌───────────────────┼────────────────────┐
             │                   │                     │
     ┌───────▼───────┐   ┌───────▼────────┐   ┌────────▼────────┐
     │ Cursor / Claude │   │  Dashboard Next  │   │  Chat (Gemini)   │
     │  Desktop (stdio) │   │  (Server Comps,  │   │  via Vercel AI   │
     │                  │   │  HTTP)           │   │  SDK (HTTP)      │
     └──────────────────┘   └──────────────────┘   └──────────────────┘
```

Isso rende três benefícios concretos:
- **Um único ponto de verdade.** Se a query do Sentry muda (por exemplo, o bug real encontrado neste projeto onde tokens de busca precisavam ser unidos por espaço, não por `+`), a correção vale para todo mundo que consome aquele tool — IDE, chat e dashboard — de uma vez.
- **IA e humanos compartilham a mesma API.** Não existe uma "API para robôs" e uma "API para gente" — o `structuredContent` que o dashboard usa para montar tabelas é o mesmo dado que o Gemini recebe para responder perguntas.
- **Plugins são opcionais e isolados.** Se as credenciais do Datadog não estiverem configuradas, o servidor sobe normalmente e só omite as tools daquela fonte — outros consumidores (dashboard, chat) simplesmente veem menos dados, não um erro fatal.

### Visão geral da arquitetura

O repositório é um **monorepo com npm workspaces** com dois pacotes:

| Pacote | Responsabilidade |
|---|---|
| `apps/mcp-server` | Servidor MCP puro. Fala com as APIs externas (Sentry, Datadog, Clarity, AWS), normaliza os dados via schemas Zod (anti-corruption layer) e expõe 4 tools por fonte. Roda via `stdio` (para IDEs) e via `Streamable HTTP` (para o dashboard). |
| `apps/dashboard` | Aplicação Next.js (App Router) que **nunca** fala diretamente com Sentry/Datadog/Clarity/AWS — só conversa com o `mcp-server` pela rede, como qualquer outro cliente MCP. |

### Stack técnica

| Camada | Escolha | Motivo |
|---|---|---|
| Protocolo | `@modelcontextprotocol/sdk` | O mesmo SDK oficial usado por clientes MCP (Cursor, Claude Desktop, Inspector) |
| Validação/ACL | Zod | Cada resposta de API externa é validada contra um schema antes de virar `structuredContent` — se a API mudar um campo, falha aqui, não silenciosamente na UI |
| Servidor MCP | Node + TypeScript (`tsx`) | Sem framework — o SDK do MCP já resolve o roteamento de tools |
| Cache | Classe `TtlCache` própria, com persistência em disco opcional | Protege cotas de API (crítico no Clarity: 10 req/dia) e sobrevive a reinícios do processo |
| Dashboard | Next.js 16 (App Router) + React 19 | Server Components fazem as chamadas MCP direto no servidor — zero API REST paralela |
| UI | Tailwind CSS v4 + shadcn/ui + lucide-react | Componentes acessíveis prontos, paleta customizada (indigo), tema claro/escuro |
| IA / Chat | Vercel AI SDK (`ai` + `@ai-sdk/google`) + Gemini | `experimental_createMCPClient` transforma as tools do MCP em tools do Gemini automaticamente — zero código de function-calling manual |
| Persistência do dashboard | `node:sqlite` (nativo do Node, sem dependência externa) | Guarda o histórico dos digests diários; escolhido depois que `better-sqlite3` se mostrou incompatível com o ambiente (crash nativo) |
| Cron | Vercel Cron (`vercel.json`) | Dispara o digest diário sem infraestrutura extra |

### Estrutura do monorepo

```
mcp-incident-orchestrator/
├── apps/
│   ├── mcp-server/               # Servidor MCP
│   │   ├── src/
│   │   │   ├── index.ts          # Entrypoint stdio (Cursor/Claude Desktop/Inspector)
│   │   │   ├── http-server.ts    # Entrypoint Streamable HTTP (dashboard)
│   │   │   ├── server-factory.ts # Monta services + registra tools condicionalmente
│   │   │   ├── *.service.ts      # 1 por fonte: chama a API externa, aplica cache, valida com Zod
│   │   │   ├── *.schema.ts       # Schemas Zod de input/output de cada fonte
│   │   │   ├── tools/            # 1 arquivo por tool MCP (capture/count/summarize/details)
│   │   │   └── lib/ttl-cache.ts  # Cache genérico com TTL + persistência em disco
│   │   └── .cache/                # Snapshots de cache em disco (git-ignored)
│   │
│   └── dashboard/                # Aplicação Next.js
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx              # Overview (KPIs + widgets estilo Clarity)
│       │   │   ├── issues/                # Erros do Sentry (lista + detalhe estilo Sentry)
│       │   │   ├── logs/                  # Logs do Datadog (lista + detalhe)
│       │   │   ├── insights/              # Insights do Clarity
│       │   │   ├── reports/               # Histórico de digests diários (SQLite)
│       │   │   ├── chat/                  # Chat com Gemini + tools do MCP
│       │   │   └── api/
│       │   │       ├── chat/              # Rota do streaming de chat (Vercel AI SDK)
│       │   │       ├── cron/daily-digest/ # Job diário: agrega as 4 fontes + Gemini + grava no SQLite
│       │   │       └── export/            # Exportação CSV (issues/logs/reports)
│       │   ├── components/                # UI compartilhada (Nav, FilterForm, MetricBar, PageTitle...)
│       │   ├── lib/
│       │   │   ├── mcp-client.ts          # Client MCP genérico (1 conexão por chamada)
│       │   │   ├── mcp-summaries.ts       # Wrappers de conveniência para os resumos das 4 fontes
│       │   │   ├── mcp-tools.ts           # Carrega as tools do MCP como tools do Vercel AI SDK
│       │   │   └── mcp-types.ts           # Tipos espelhando o structuredContent de cada tool
│       │   └── db/                        # Client SQLite (node:sqlite) + schema hand-rolled
│       └── vercel.json                    # Configuração do cron diário
│
└── package.json                  # Root do workspace (npm workspaces)
```

### O servidor MCP em detalhe

#### O padrão de 4 tools por fonte

Cada integração (Sentry, Datadog, Clarity*, AWS CloudWatch) segue o mesmo contrato de 4 ferramentas:

| Tool | O que faz |
|---|---|
| **capture** (`fetch_*`) | Lista os itens mais recentes que casam com um filtro (rota, ambiente, intervalo de datas) |
| **count** (`count_*`) | Devolve só a contagem — usa endpoints de agregação da própria API quando existem, evitando baixar a lista inteira só para contar |
| **summarize** (`summarize_*`) | Agrega os dados capturados (top causas, distribuição por status/serviço) — quando possível, reaproveita a chamada de `capture` em vez de bater na API de novo |
| **details** (`get_*_details`) | Busca o contexto completo de um item específico (stack trace, breadcrumbs, contexto de navegador/SO/geolocalização, requisição HTTP) |

*Clarity expõe hoje só a tool de insights agregados (a API pública do Clarity não tem um endpoint de "listar sessões individuais" equivalente aos outros três).

#### Anti-Corruption Layer

Toda resposta de API externa passa por um schema Zod antes de virar `structuredContent`. Isso não é boilerplate — foi o que permitiu, por exemplo, descobrir e corrigir um bug real de longa data: a busca de issues do Sentry unia os termos da query com `+`, que depois de `encodeURIComponent` virava `%2B` e era decodificado pelo Sentry como um `+` *literal* dentro do valor (não como separador de termos), quebrando silenciosamente os filtros de ambiente/rota desde que foram implementados. Corrigido unindo os termos com espaço.

#### Dois transportes, um só servidor

- **stdio** (`npm run dev` dentro de `apps/mcp-server`): usado por IDEs/clientes MCP como Cursor, Claude Desktop e o MCP Inspector.
- **Streamable HTTP** (`npm run start:http`, porta `3333` por padrão): usado pelo dashboard e pelo chat. Modo *stateless* — cada requisição monta um `McpServer` novo, mas os **services** (e seus caches) são criados uma única vez por processo, então o cache sobrevive entre requisições.

#### Cache com proteção de cota

Cada `service` mantém um `TtlCache` (TTL configurável por fonte) para evitar bater na API externa repetidamente com a mesma pergunta. O caso mais crítico é o Clarity, cuja API pública tem um teto **duro de 10 requisições/dia por projeto** — por isso:
- TTL de 1 hora nas consultas de insights;
- **persistência em disco** (`.cache/*.json`): o cache é escrito a cada atualização e recarregado na inicialização do processo, então reiniciar o servidor (comum em desenvolvimento, ou após um deploy/crash em produção) não zera a proteção de cota.

### O dashboard em detalhe

- **Overview** — KPIs das 4 fontes e widgets estilo Microsoft Clarity (cards com faixa de cor por fonte, listas com barra proporcional preenchida em vez de números soltos).
- **Issues (Sentry)** — lista filtrável por ambiente/rota/intervalo de datas; ao clicar, abre um detalhe **estilo Sentry**: contexto (navegador, SO, dispositivo, localização, idioma, fuso horário), requisição HTTP, stack trace e linha do tempo de breadcrumbs.
- **Logs (Datadog)** — mesmo padrão de lista + detalhe para logs.
- **Insights (Clarity)** — sessões, rage clicks, dead clicks, erros de script e páginas mais visitadas.
- **Relatórios** — histórico dos digests diários gerados pelo cron, lidos do SQLite local.
- **Chat** — conversa em linguagem natural com o Gemini, que tem acesso automático a todas as tools do MCP (perguntas como "o que aconteceu ontem na tela de checkout?" disparam as tools certas sozinhas).
- **Exportação CSV** — issues, logs e relatórios podem ser baixados como planilha, replicando os mesmos filtros aplicados na tela.
- **Mobile-first** — listas viram cards empilhados em telas pequenas e tabela completa em telas maiores; formulários de filtro em grid 2 colunas no mobile.
- **Acessibilidade** — skip link, `lang="pt-BR"` correto, `aria-current`/`aria-expanded`/`aria-live` onde relevante, foco visível em todos os elementos interativos, cursor de mão em todo elemento clicável.

### Como rodar localmente

Pré-requisitos: Node 22.5+ (usa `node:sqlite`, que exige `--experimental-sqlite` — já configurado nos scripts via `cross-env`).

```bash
# 1. Instalar dependências (na raiz, resolve os dois workspaces)
npm install

# 2. Configurar variáveis de ambiente
cp apps/mcp-server/.env.example apps/mcp-server/.env
cp apps/dashboard/.env.local.example apps/dashboard/.env.local
# preencha os tokens (ver seção abaixo)

# 3. Subir o servidor MCP via HTTP (porta 3333)
npm run start:http --workspace=apps/mcp-server

# 4. Em outro terminal, subir o dashboard (porta 3000)
npm run dev --workspace=apps/dashboard
```

Acesse `http://localhost:3000`. Para usar com Cursor/Claude Desktop/Inspector em vez do dashboard, use `npm run dev --workspace=apps/mcp-server` (transporte stdio) e aponte o cliente MCP para esse comando.

### Variáveis de ambiente

**`apps/mcp-server/.env`** — só `SENTRY_AUTH_TOKEN`/`SENTRY_ORG_SLUG` são obrigatórias; os outros três plugins são opcionais e simplesmente ficam de fora se as credenciais faltarem:

```
SENTRY_AUTH_TOKEN=
SENTRY_ORG_SLUG=

DATADOG_API_KEY=        # opcional
DATADOG_APP_KEY=        # opcional
DATADOG_SITE=datadoghq.com

CLARITY_API_TOKEN=      # opcional

AWS_REGION=              # opcional
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_LOG_GROUP_NAME=
```

**`apps/dashboard/.env.local`**:

```
MCP_SERVER_URL=http://localhost:3333/mcp
SENTRY_PROJECT_SLUG=

GOOGLE_GENERATIVE_AI_API_KEY=   # opcional — sem ela, o chat/digest usam fallback determinístico
GEMINI_MODEL=gemini-flash-latest

SQLITE_PATH=./data/app.db
CRON_SECRET=
```

> As credenciais do Sentry/Datadog/Clarity/AWS ficam **só** no `.env` do `mcp-server` — o dashboard nunca as vê diretamente, só fala com o servidor MCP pela rede.

### Decisões técnicas notáveis

- **`node:sqlite` em vez de `better-sqlite3`**: o addon nativo do `better-sqlite3` causava um *access violation* reproduzível até em um projeto isolado de teste — sinal de incompatibilidade real de ambiente, não bug do projeto. A alternativa nativa do Node (behind `--experimental-sqlite`) resolveu sem depender de um binário compilado.
- **`export const dynamic = 'force-dynamic'`** em toda página que depende do MCP server ou do SQLite — sem isso, o Next tenta pré-renderizar essas páginas em build time, quando o MCP server não está acessível (especialmente relevante para deploy na Vercel).
- **Sem ORM no dashboard**: o driver `node-sqlite` do Drizzle só existe em uma versão `1.0.0-rc` não estável — para uma única tabela, SQL puro com `node:sqlite` foi a escolha mais simples e menos arriscada.
- **Uma conexão MCP nova por chamada** no dashboard (`callMcpTool`): simples e seguro para o modelo de request do Next.js, onde cada Server Component roda de forma independente — o overhead de handshake é aceitável no volume de um dashboard interno.

### Limitações conhecidas e roadmap

- **Sem autenticação no dashboard** — assumido como aceitável para uso local/rede confiável; um gap conhecido antes de expor publicamente.
- **Sem paginação por cursor no Sentry** — o limite de 100 issues por chamada é o teto de uma única página da API; útil para o volume atual, mas não escala para milhares de issues sem paginação real.
- **Layout estilo Clarity** aplicado hoje em Overview/Insights; as tabelas de Issues/Logs ainda usam o layout de lista simples.
- **Relatório de IA no formato "deep dive"** (causa raiz por tipo de erro + tabela quantitativa) ainda não implementado — depende de uma chave do Gemini validada ponta a ponta.

---

## 🇺🇸 English

### Table of contents

- [The idea](#the-idea)
- [The problem it solves](#the-problem-it-solves)
- [Why this architecture](#why-this-architecture)
- [Architecture overview](#architecture-overview)
- [Tech stack](#tech-stack)
- [Monorepo structure](#monorepo-structure)
- [The MCP server in detail](#the-mcp-server-in-detail)
- [The dashboard in detail](#the-dashboard-in-detail)
- [Running locally](#running-locally)
- [Environment variables](#environment-variables)
- [Notable technical decisions](#notable-technical-decisions)
- [Known limitations and roadmap](#known-limitations-and-roadmap)

---

### The idea

Engineering teams rarely have **one** place to understand "what's happening with the application right now." Frontend errors live in Sentry, backend logs live in Datadog (or CloudWatch), real user behavior (rage clicks, dead clicks, sessions) lives in Microsoft Clarity — and answering a simple question like *"are today's errors on the scheduling screen related to the rage-click spike I saw in Clarity?"* means opening three different tools, in three different tabs, and manually correlating the data in your head.

This project starts from an architectural question: **what if, instead of building a dashboard that integrates directly with each API (Sentry SDK here, Datadog SDK there), the data-access layer itself was an MCP server — the same protocol AI tools like Claude and Cursor use to call external tools?**

In practice this means:
- The **same code** that fetches "unresolved Sentry issues" can be called by an AI assistant inside Cursor (via stdio), by a Gemini-powered chat inside the dashboard itself (via HTTP), or by a Next.js server-side page (also via HTTP) — without duplicating integration logic in three places.
- Adding a new data source (e.g. AWS CloudWatch Logs, added after the initial three) means writing a new plugin that follows the same contract — not reinventing the architecture.
- The "intelligence" of deciding *which* data to fetch to answer a natural-language question ("what happened yesterday afternoon?") is delegated to the LLM, which already knows how to do function calling — the server just needs to expose well-defined, well-documented tools.

### The problem it solves

1. **Observability fragmentation.** Errors, logs, and user behavior live in separate tools, each with its own UI, its own query language, and its own data model.
2. **Duplicated integration logic.** Without an MCP layer, every consumer (dashboard, chatbot, automation script) would need to reimplement auth, pagination, and parsing for each external API.
3. **Context fatigue while investigating incidents.** Understanding an error's root cause usually requires context (browser, OS, geolocation, breadcrumbs, HTTP request) scattered across different tabs of the source tool itself.
4. **No consolidated history.** "What changed since yesterday?" is a question none of these tools answer on their own — something (or someone) needs to run a daily summary and store it somewhere queryable.
5. **Tight API quotas.** Tools like Clarity impose hard limits (10 requests/day per project) — a naive architecture that hits the API on every user question burns through the quota in a few hours of use.

### Why this architecture

The project's central decision was to treat **MCP as the domain layer**, not as an AI afterthought:

```
                     ┌─────────────────────────────┐
                     │      MCP Server (Node)       │
                     │  stdio  +  Streamable HTTP    │
                     │                               │
                     │  Plugins (1 per source):      │
                     │   • Sentry                    │
                     │   • Datadog                    │
                     │   • Microsoft Clarity          │
                     │   • AWS CloudWatch Logs        │
                     │                               │
                     │  4 tools per plugin:           │
                     │   capture / count / summarize / │
                     │   details                      │
                     └───────────┬───────────────────┘
                                 │
             ┌───────────────────┼────────────────────┐
             │                   │                     │
     ┌───────▼───────┐   ┌───────▼────────┐   ┌────────▼────────┐
     │ Cursor / Claude │   │  Next.js         │   │  Chat (Gemini)   │
     │  Desktop (stdio) │   │  Dashboard        │   │  via Vercel AI   │
     │                  │   │  (Server Comps,  │   │  SDK (HTTP)      │
     │                  │   │  HTTP)           │   │                  │
     └──────────────────┘   └──────────────────┘   └──────────────────┘
```

This yields three concrete benefits:
- **A single source of truth.** If the Sentry query changes (for example, the real long-standing bug found in this project, where search tokens needed to be joined with a space instead of `+`), the fix applies to everyone consuming that tool — IDE, chat, and dashboard — at once.
- **AI and humans share the same API.** There's no "API for robots" and "API for people" — the `structuredContent` the dashboard uses to build tables is the same data Gemini receives to answer questions.
- **Plugins are optional and isolated.** If Datadog credentials aren't configured, the server still boots normally and simply omits that source's tools — other consumers (dashboard, chat) just see less data, not a fatal error.

### Architecture overview

The repository is an **npm-workspaces monorepo** with two packages:

| Package | Responsibility |
|---|---|
| `apps/mcp-server` | Pure MCP server. Talks to external APIs (Sentry, Datadog, Clarity, AWS), normalizes data through Zod schemas (anti-corruption layer), and exposes 4 tools per source. Runs over `stdio` (for IDEs) and `Streamable HTTP` (for the dashboard). |
| `apps/dashboard` | Next.js (App Router) application that **never** talks directly to Sentry/Datadog/Clarity/AWS — it only talks to `mcp-server` over the network, like any other MCP client. |

### Tech stack

| Layer | Choice | Why |
|---|---|---|
| Protocol | `@modelcontextprotocol/sdk` | The same official SDK used by MCP clients (Cursor, Claude Desktop, Inspector) |
| Validation/ACL | Zod | Every external API response is validated against a schema before becoming `structuredContent` — if the API changes a field, it fails here, not silently in the UI |
| MCP server | Node + TypeScript (`tsx`) | No framework — the MCP SDK already handles tool routing |
| Cache | Custom `TtlCache` class, with optional disk persistence | Protects API quotas (critical for Clarity: 10 req/day) and survives process restarts |
| Dashboard | Next.js 16 (App Router) + React 19 | Server Components make the MCP calls directly on the server — zero parallel REST API |
| UI | Tailwind CSS v4 + shadcn/ui + lucide-react | Ready-made accessible components, custom (indigo) palette, light/dark theme |
| AI / Chat | Vercel AI SDK (`ai` + `@ai-sdk/google`) + Gemini | `experimental_createMCPClient` turns MCP tools into Gemini tools automatically — zero manual function-calling code |
| Dashboard persistence | `node:sqlite` (Node built-in, no external dependency) | Stores daily digest history; chosen after `better-sqlite3` proved incompatible with the environment (native crash) |
| Cron | Vercel Cron (`vercel.json`) | Triggers the daily digest with no extra infrastructure |

### Monorepo structure

```
mcp-incident-orchestrator/
├── apps/
│   ├── mcp-server/               # MCP server
│   │   ├── src/
│   │   │   ├── index.ts          # stdio entrypoint (Cursor/Claude Desktop/Inspector)
│   │   │   ├── http-server.ts    # Streamable HTTP entrypoint (dashboard)
│   │   │   ├── server-factory.ts # Builds services + conditionally registers tools
│   │   │   ├── *.service.ts      # One per source: calls the external API, applies caching, validates with Zod
│   │   │   ├── *.schema.ts       # Zod input/output schemas per source
│   │   │   ├── tools/            # One file per MCP tool (capture/count/summarize/details)
│   │   │   └── lib/ttl-cache.ts  # Generic TTL cache with disk persistence
│   │   └── .cache/                # On-disk cache snapshots (git-ignored)
│   │
│   └── dashboard/                # Next.js application
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx              # Overview (KPIs + Clarity-style widgets)
│       │   │   ├── issues/                # Sentry errors (list + Sentry-style detail)
│       │   │   ├── logs/                  # Datadog logs (list + detail)
│       │   │   ├── insights/              # Clarity insights
│       │   │   ├── reports/               # Daily digest history (SQLite)
│       │   │   ├── chat/                  # Gemini chat + MCP tools
│       │   │   └── api/
│       │   │       ├── chat/              # Chat streaming route (Vercel AI SDK)
│       │   │       ├── cron/daily-digest/ # Daily job: aggregates the 4 sources + Gemini + writes to SQLite
│       │   │       └── export/            # CSV export (issues/logs/reports)
│       │   ├── components/                # Shared UI (Nav, FilterForm, MetricBar, PageTitle...)
│       │   ├── lib/
│       │   │   ├── mcp-client.ts          # Generic MCP client (one connection per call)
│       │   │   ├── mcp-summaries.ts       # Convenience wrappers for the 4 sources' summaries
│       │   │   ├── mcp-tools.ts           # Loads MCP tools as Vercel AI SDK tools
│       │   │   └── mcp-types.ts           # Types mirroring each tool's structuredContent
│       │   └── db/                        # SQLite client (node:sqlite) + hand-rolled schema
│       └── vercel.json                    # Daily cron configuration
│
└── package.json                  # Workspace root (npm workspaces)
```

### The MCP server in detail

#### The 4-tools-per-source pattern

Every integration (Sentry, Datadog, Clarity*, AWS CloudWatch) follows the same 4-tool contract:

| Tool | What it does |
|---|---|
| **capture** (`fetch_*`) | Lists the most recent items matching a filter (route, environment, date range) |
| **count** (`count_*`) | Returns just the count — uses the API's own aggregation endpoints when available, avoiding downloading the whole list just to count it |
| **summarize** (`summarize_*`) | Aggregates captured data (top culprits, status/service distribution) — reuses the `capture` call when possible instead of hitting the API again |
| **details** (`get_*_details`) | Fetches full context for a specific item (stack trace, breadcrumbs, browser/OS/geolocation context, HTTP request) |

*Clarity currently only exposes the aggregated-insights tool (Clarity's public API has no "list individual sessions" endpoint equivalent to the other three).

#### Anti-corruption layer

Every external API response passes through a Zod schema before becoming `structuredContent`. This isn't boilerplate — it's what allowed catching and fixing a real, long-standing bug: the Sentry issue search joined query tokens with `+`, which after `encodeURIComponent` became `%2B` and was decoded by Sentry as a *literal* `+` inside the value (not as a token separator), silently breaking the environment/route filters ever since they were added. Fixed by joining tokens with a space instead.

#### Two transports, one server

- **stdio** (`npm run dev` inside `apps/mcp-server`): used by IDEs/MCP clients like Cursor, Claude Desktop, and the MCP Inspector.
- **Streamable HTTP** (`npm run start:http`, port `3333` by default): used by the dashboard and chat. Stateless mode — every request builds a fresh `McpServer`, but the **services** (and their caches) are created once per process, so the cache survives across requests.

#### Quota-protected caching

Each `service` keeps a `TtlCache` (per-source configurable TTL) to avoid repeatedly hitting the external API with the same question. The most critical case is Clarity, whose public API has a **hard cap of 10 requests/day per project** — hence:
- 1-hour TTL on insight queries;
- **disk persistence** (`.cache/*.json`): the cache is written on every update and reloaded on process startup, so restarting the server (common during development, or after a deploy/crash in production) doesn't reset the quota protection.

### The dashboard in detail

- **Overview** — KPIs from all 4 sources and Microsoft-Clarity-style widgets (cards with a per-source color accent, lists with a proportional filled bar instead of loose numbers).
- **Issues (Sentry)** — filterable list by environment/route/date range; clicking opens a **Sentry-style** detail view: context (browser, OS, device, location, locale, timezone), HTTP request, stack trace, and a breadcrumb timeline.
- **Logs (Datadog)** — same list + detail pattern for logs.
- **Insights (Clarity)** — sessions, rage clicks, dead clicks, script errors, and top visited pages.
- **Reports** — history of daily digests generated by the cron job, read from local SQLite.
- **Chat** — natural-language conversation with Gemini, which automatically has access to every MCP tool (questions like "what happened yesterday on the checkout screen?" trigger the right tools on their own).
- **CSV export** — issues, logs, and reports can be downloaded as a spreadsheet, replicating the same filters applied on screen.
- **Mobile-first** — lists become stacked cards on small screens and full tables on larger ones; filter forms use a 2-column grid on mobile.
- **Accessibility** — skip link, correct `lang="pt-BR"`, `aria-current`/`aria-expanded`/`aria-live` where relevant, visible focus on every interactive element, pointer cursor on every clickable element.

### Running locally

Prerequisites: Node 22.5+ (uses `node:sqlite`, which requires `--experimental-sqlite` — already wired into the scripts via `cross-env`).

```bash
# 1. Install dependencies (from the root, resolves both workspaces)
npm install

# 2. Configure environment variables
cp apps/mcp-server/.env.example apps/mcp-server/.env
cp apps/dashboard/.env.local.example apps/dashboard/.env.local
# fill in the tokens (see section below)

# 3. Start the MCP server over HTTP (port 3333)
npm run start:http --workspace=apps/mcp-server

# 4. In another terminal, start the dashboard (port 3000)
npm run dev --workspace=apps/dashboard
```

Visit `http://localhost:3000`. To use with Cursor/Claude Desktop/Inspector instead of the dashboard, use `npm run dev --workspace=apps/mcp-server` (stdio transport) and point your MCP client at that command.

### Environment variables

**`apps/mcp-server/.env`** — only `SENTRY_AUTH_TOKEN`/`SENTRY_ORG_SLUG` are required; the other three plugins are optional and simply get left out if their credentials are missing:

```
SENTRY_AUTH_TOKEN=
SENTRY_ORG_SLUG=

DATADOG_API_KEY=        # optional
DATADOG_APP_KEY=        # optional
DATADOG_SITE=datadoghq.com

CLARITY_API_TOKEN=      # optional

AWS_REGION=              # optional
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_LOG_GROUP_NAME=
```

**`apps/dashboard/.env.local`**:

```
MCP_SERVER_URL=http://localhost:3333/mcp
SENTRY_PROJECT_SLUG=

GOOGLE_GENERATIVE_AI_API_KEY=   # optional — without it, chat/digest fall back to a deterministic summary
GEMINI_MODEL=gemini-flash-latest

SQLITE_PATH=./data/app.db
CRON_SECRET=
```

> Sentry/Datadog/Clarity/AWS credentials live **only** in `mcp-server`'s `.env` — the dashboard never sees them directly, it only talks to the MCP server over the network.

### Notable technical decisions

- **`node:sqlite` instead of `better-sqlite3`**: `better-sqlite3`'s native addon caused a reproducible access violation, even in an isolated test project — a sign of genuine environment incompatibility, not a project bug. Node's built-in alternative (behind `--experimental-sqlite`) solved it without depending on a compiled binary.
- **`export const dynamic = 'force-dynamic'`** on every page that depends on the MCP server or SQLite — without it, Next tries to statically prerender those pages at build time, when the MCP server isn't reachable (especially relevant for Vercel deploys).
- **No ORM in the dashboard**: Drizzle's `node-sqlite` driver only exists as an unstable `1.0.0-rc` release — for a single table, plain SQL over `node:sqlite` was the simpler, lower-risk choice.
- **A fresh MCP connection per call** in the dashboard (`callMcpTool`): simple and safe for Next.js's request model, where every Server Component runs independently — the handshake overhead is acceptable at the volume of an internal dashboard.

### Known limitations and roadmap

- **No dashboard authentication** — assumed acceptable for local/trusted-network use; a known gap before exposing this publicly.
- **No cursor-based pagination on Sentry** — the 100-issue-per-call limit is a single API page's ceiling; fine for current volume, but doesn't scale to thousands of issues without real pagination.
- **Clarity-style layout** currently applied to Overview/Insights; the Issues/Logs tables still use the simple list layout.
- **AI "deep dive" report** (root cause per error type + quantitative summary table) not yet implemented — depends on a Gemini key validated end-to-end.
