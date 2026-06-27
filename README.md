# Klarke Control — Ecossistema Operacional

Painel administrativo e central de monitoramento da **Klarke Solutions**: gestão de
máquinas e acessos remotos, câmeras, dispositivos de rede, chamados de suporte,
inventário, cofre de credenciais, VoIP, acervo técnico e auditoria — com monitoramento
de saúde em tempo real e abertura pública de chamados.

---

## Sumário

- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Rodando em desenvolvimento](#rodando-em-desenvolvimento)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Build e deploy](#build-e-deploy)
- [Módulos / rotas](#módulos--rotas)
- [Kiosk público de chamados (Klarke Flow)](#kiosk-público-de-chamados-klarke-flow)
- [Monitoramento de locais (ping de IPs públicos)](#monitoramento-de-locais-ping-de-ips-públicos)
- [Agentes de monitoramento e Klarke Repair](#agentes-de-monitoramento-e-klarke-repair)
- [Etiquetas térmicas](#etiquetas-térmicas)
- [Segurança](#segurança)
- [Manutenção e qualidade](#manutenção-e-qualidade)

---

## Stack

| Camada    | Tecnologia                                                        |
|-----------|-------------------------------------------------------------------|
| Frontend  | React 18 + Vite 5, React Router, Axios, lucide-react, PWA         |
| Backend   | Node.js (>=18) + Express 5, JWT, bcryptjs, multer                 |
| Banco     | SQLite (módulo nativo `node:sqlite`), arquivo `backend/database.sqlite` |
| Infra     | nginx (proxy reverso + HTTPS) + PM2 na VPS de produção            |

## Arquitetura

```
                 ┌──────────────────────────────┐
   navegador ───▶│  nginx (80/443, HTTPS)        │
                 │  dashboard.klarke.com.br       │
                 └───────────────┬────────────────┘
                                 │ proxy
                 ┌───────────────▼────────────────┐
                 │  Express  (porta 3001)          │
                 │  - serve frontend/dist (SPA)    │
                 │  - /api/*  (REST + JWT)         │
                 │  - /uploads/* (fotos/snapshots) │
                 │  - polling de ping (locais)     │
                 └───────────────┬────────────────┘
                                 │
                 ┌───────────────▼────────────────┐
                 │  SQLite (backend/database.sqlite)│
                 └─────────────────────────────────┘
```

O mesmo processo Express serve **a SPA**, **a API** e os **uploads**. Em produção o
nginx faz o TLS e encaminha para a porta 3001.

## Estrutura do projeto

```
KLARKE/
├── backend/
│   ├── server.js          # API Express, auth, monitoramento, uploads
│   ├── database.sqlite     # banco (não versionado)
│   ├── migrate-encrypt.js  # cifra senhas legadas em repouso (idempotente)
│   ├── alter-db*.js        # migrações pontuais de schema
│   ├── uploads/            # fotos de chamados e snapshots (não versionado)
│   └── .env.example        # modelo das variáveis de ambiente
├── frontend/
│   ├── src/
│   │   ├── pages/          # uma página por módulo (Home, Dashboard, Tickets, …)
│   │   ├── components/     # Layout, Navbar, ConfirmModal
│   │   └── utils/auth.js   # headers de autenticação para o Axios
│   ├── public/
│   │   ├── flow.html       # kiosk público de abertura de chamados
│   │   └── …               # ícones/manifests do PWA
│   └── vite.config.js      # proxy de /api e /uploads no dev server
├── repair-tool/            # utilitário de reparo distribuído ao cliente
│   ├── main.py             # versão Python/PyInstaller (legado)
│   └── portable/           # versão portable atual (PowerShell + HTML)
└── package.json            # scripts de build/start do monorepo
```

## Rodando em desenvolvimento

Pré-requisitos: Node.js >= 18.

```bash
# 1) Backend
cd backend
npm install
cp .env.example .env      # preencha as chaves (ver abaixo)
node server.js            # sobe a API em http://localhost:3001

# 2) Frontend (em outro terminal)
cd frontend
npm install
npm run dev               # Vite em http://localhost:5173
```

O dev server do Vite faz proxy de `/api` **e** `/uploads` para `localhost:3001`, então
as fotos de chamados aparecem normalmente em desenvolvimento.

## Variáveis de ambiente

Definidas em `backend/.env` (em produção, em `/var/www/klarke/.env`). Veja
`backend/.env.example` para o modelo completo.

| Variável          | Obrigatória | Descrição                                                                 |
|-------------------|:-----------:|---------------------------------------------------------------------------|
| `PORT`            |     não     | Porta do Express (padrão 3001).                                           |
| `SECRET_KEY`      |   **sim**   | Segredo de assinatura dos JWT. Sem ela o servidor encerra (`exit 1`).     |
| `MONITORING_TOKEN`|   **sim**   | Header `x-monitor-token` exigido nas rotas de heartbeat/snapshot.         |
| `ENCRYPTION_KEY`  |   **sim**   | AES-256 (base64, 32 bytes). Cifra senhas no banco. **Não troque após migrar.** |
| `ALLOWED_ORIGINS` |  recomend.  | Allowlist de CORS (vírgula). Vazio = CORS aberto (apenas para dev).       |

Gerar segredos:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # SECRET_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"  # MONITORING_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"     # ENCRYPTION_KEY
```

## Build e deploy

```bash
# Build do frontend (gera frontend/dist, servido pelo Express)
cd frontend && npm run build
```

Deploy em produção (VPS, via git):

```bash
git pull
cd frontend && npm run build
pm2 restart klarke-app
```

O app fica em `/var/www/klarke`, gerenciado por PM2 (`klarke-app`), atrás do nginx em
`dashboard.klarke.com.br`. Migração de criptografia (uma vez, após configurar
`ENCRYPTION_KEY`): `node backend/migrate-encrypt.js`.

## Módulos / rotas

Tudo sob `/control` exige login (JWT). Rota pública: `/` (login) e o kiosk `flow.html`.

| Rota                      | Módulo            | Função                                            |
|---------------------------|-------------------|---------------------------------------------------|
| `/control`                | Home              | Command center: saúde global, disco, chamados, locais |
| `/control/machines`       | Dashboard         | Parque de máquinas, acessos RustDesk/AnyDesk, etiquetas |
| `/control/cameras`        | Cameras           | Câmeras e snapshots                               |
| `/control/network`        | NetworkDevices    | Switches/roteadores/APs                           |
| `/control/network-map`    | NetworkMap        | Mapa visual da rede                               |
| `/control/tickets`        | Tickets           | Chamados de suporte (com fotos e histórico)       |
| `/control/action-plan`    | ActionPlan        | Tarefas / plano de ação                           |
| `/control/inventory`      | Inventory         | Inventário / estoque                              |
| `/control/key-keeper`     | KeyKeeper         | Cofre de credenciais (cifradas)                   |
| `/control/voip`           | Voip              | Ramais / VoIP                                     |
| `/control/technical-docs` | TechnicalDocs     | Acervo técnico (uploads de documentos)            |
| `/control/mail`           | Mail              | Módulo de e-mail                                  |
| `/control/users`          | Users             | Gestão de usuários (apenas admin)                 |
| `/control/audit-logs`     | AuditLogs         | Trilha de auditoria                               |

## Kiosk público de chamados (Klarke Flow)

`frontend/public/flow.html` é uma página independente, acessível sem login, onde
qualquer dispositivo da rede abre chamados. Ela consome `POST /api/tickets` (rota
pública), que aceita até 3 fotos em base64 — gravadas em `backend/uploads/` como
`ticket_<timestamp>_<i>.jpg` e referenciadas por nome de arquivo no campo `photo`.

As fotos são exibidas no módulo **Tickets** via `/uploads/<arquivo>`. O helper
`resolveUploadUrl` tolera formatos legados (data URL / caminho já completo).

## Monitoramento de locais (ping de IPs públicos)

O backend mantém uma lista de **locais gerenciados** (IPs/hosts públicos de cada ponto)
na tabela SQLite `managed_sites` e faz polling de ping a cada 60s (concorrência
limitada a 10), guardando latência e disponibilidade num cache em memória (`pingCache`).
Na primeira execução, a tabela é semeada com `45.161.6.51` ("Local Principal").

- Gerenciamento pela UI: na **Home**, o card **Saúde Global** tem um botão **+** que
  abre um modal para cadastrar/remover IPs. O IP é validado no backend
  (`/^[a-zA-Z0-9.:_-]{1,253}$/`) e o ping também sanitiza o alvo antes do `exec`.
- Endpoints (todos exigem auth): `GET/POST /api/monitoring/sites`,
  `DELETE /api/monitoring/sites/:id` e `GET /api/system-status`
  (disco + latência média dos locais online + `sites`/`sitesOnline`/`sitesTotal`).
- **Saúde Global** é calculada exclusivamente pelo ping (`sitesOnline/sitesTotal`); o
  card também exibe os contadores de ativos cadastrados (PCs, câmeras, VoIP).

## Agentes de monitoramento e Klarke Repair

- **Agentes** instalados nas máquinas reportam via `POST /api/monitoring/heartbeat` e
  `POST /api/monitoring/snapshot`, exigindo o header `x-monitor-token`
  (= `MONITORING_TOKEN`).
- **Klarke Repair** é um utilitário entregue ao cliente. A distribuição atual é a
  pasta `repair-tool/portable/` (PowerShell + HTML). A rota
  `GET /api/monitoring/repair-download` serve um `repair-tool/Klarke Repair.zip` quando
  presente no servidor (responde 404 se ausente — o `.zip` é gerado/hospedado à parte
  e não versionado).

## Etiquetas térmicas

No módulo **Máquinas**, o botão **ETIQUETA** (`handlePrintLabel`) abre uma janela de
impressão dimensionada para **impressora térmica, papel 82×25mm**, em **duas colunas**:

- Coluna esquerda: marca + **nome da máquina**.
- Coluna direita: **RustDesk ID** e **AnyDesk ID** (monoespaçado).

O tamanho físico é fixado por `@page { size: 82mm 25mm }`. Selecione a impressora
térmica e o papel 82×25mm no diálogo de impressão.

## Segurança

Endurecimentos aplicados (ver também o histórico de commits):

- `SECRET_KEY`, `MONITORING_TOKEN` e `ENCRYPTION_KEY` obrigatórios; sem segredos o
  servidor não sobe ou as rotas correspondentes ficam indisponíveis.
- Senhas de credenciais/máquinas/câmeras/rede/VoIP **cifradas em repouso**
  (AES-256-GCM, prefixo `enc:v1:`).
- CORS por allowlist (`ALLOWED_ORIGINS`), cabeçalhos de segurança e **CSP** afinada.
- Gestão de usuários e `/api/backup` exigem `role: 'admin'` (backdoor removido).
- Reset de senha gera senha aleatória; admin com senha padrão é forçado a trocar.
- Uploads bloqueiam extensões executáveis/scripts; ping sanitiza o alvo antes do `exec`.

Pendência de infra (não é código): **HTTPS** depende do proxy reverso (nginx) — já
configurado em produção.

## Manutenção e qualidade

- **Build:** `cd frontend && npm run build` deve concluir sem erros.
- **Lint:** `cd frontend && npx eslint src` ainda acusa avisos pré-existentes (imports
  não usados e regras de hooks). Não afetam o funcionamento; são candidatos a limpeza
  incremental.
- **Artefatos de build** (`repair-tool/build/`, `__pycache__`, `dist/`,
  `dist-electron/`) e **uploads de runtime** (`backend/uploads/`) são ignorados pelo
  git — não versione-os.
- **Banco:** `backend/database.sqlite` não é versionado; faça backup via
  `GET /api/backup` (admin) ou copiando o arquivo.
