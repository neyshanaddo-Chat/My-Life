# Personal Life Manager — Architecture

Application One of the Personal Operating System. This document records the
important technical decisions and why they were made. Update it whenever a
decision changes.

## The big picture

```
                    ┌──────────────────────────────┐
  Phone / laptop    │  Personal Life Manager (PWA) │   ← this repo (Stage 1)
                    │  local copy in IndexedDB     │
                    └──────────────┬───────────────┘
                                   │ HTTPS + scoped token   (Stage 3)
                    ┌──────────────▼───────────────┐
                    │      Personal Data Hub       │
                    │  API (TypeScript) + Postgres │
                    │  permissions · approvals ·   │
                    │  audit log · sync            │
                    └──┬────────┬────────┬────────┬┘
                       │        │        │        │
                  Obsidian    n8n     AI agents  System Terminal
                  (vault)  (workflows) (Claude,   (Application Two,
                                       OpenAI,     admin scope —
                                       AI-TOS,     later)
                                       local LLM)
```

Every app and every AI agent talks to the **Hub API**, never straight to the
database. That one rule is what makes permissions, approvals and the audit log
enforceable, and it is what lets the System Terminal plug in later without a
rebuild (it is just another client with an admin scope).

## Decisions

### 1. Frontend: installable web app (PWA), plain JavaScript modules, no build step
- Works on Windows, Mac, iPhone and Android from one codebase; installs to the
  home screen / as a laptop app; works offline.
- No build step means the files in this repo are exactly what runs. Easy to
  review, nothing to install, hosted free on GitHub Pages.
- Revisit if the UI grows large enough to need a framework (Svelte or React +
  Vite). The data layer is kept separate from the screens so that switch would
  not touch storage or sync.

### 2. Local-first storage: IndexedDB on each device
- Your data lives in the browser's database on the device, not in this repo
  and not on GitHub. **The repo is public — it only ever holds code.**
- Every record already carries the fields the Hub will need for sync
  (`id`, `created_at`, `updated_at`, `deleted_at`, `source`, `rev`), so Stage 3
  is "connect and upload", not "redesign".
- Deletes are soft (`deleted_at`) so they can be synced and audited.
- Settings → Backup exports everything as one JSON file (data portability).
- Limitation until the Hub exists: each device has its own copy. Use
  export/import to move data between devices.

### 3. Personal Data Hub: PostgreSQL + a TypeScript API (recommended)
- **PostgreSQL** confirmed as the right choice: relational data (tasks ↔ goals ↔
  events), JSONB for flexible per-app fields, row-level security available,
  `pgvector` for searching notes with AI later, mature backups.
  SQLite was considered (simpler, single file) but is weaker for several apps
  and agents writing at once, which is the whole point of the Hub.
- **API in TypeScript (Fastify)**: same language as the app, and n8n is also
  Node-based. Python (FastAPI) is a fine alternative if AI work leans Python;
  the API contract would be the same.
- Runs in Docker so the same setup works on a Windows PC (local-first) or a
  Hostinger VPS (always reachable). **Where it lives is an open decision — see
  ROADMAP.md.**
- Draft schema: `docs/hub-schema.sql`.

### 4. Permissions, approvals and audit (enforced by the Hub)
- Each connected app or agent gets its own credential with **scopes** per data
  type: `read`, `propose`, `write`, or `none`; plus a rule per scope:
  `auto`, `needs_approval`, or `restricted`.
- A write that needs approval becomes a row in `proposals`; nothing changes
  until you approve it in the Sync & Verification Centre.
- Every read, write, approval and rejection is appended to `audit_log`
  (source, destination, requester, decision, outcome).
- **AI agents default to `propose` only.** No agent gets `write` unless you
  grant it per data type.

### 5. Integrations (later stages)
- **Obsidian:** notes are stored as Markdown already, so they map 1:1 to `.md`
  files with frontmatter. The Hub will sync a chosen vault folder (or use the
  Obsidian Local REST API plugin).
- **n8n:** connects as an app with its own token; Hub can call n8n webhooks on
  events (e.g. "task completed").
- **AI-TOS (Hostinger):** stays a separate project; connects as an agent
  through the Hub API.
- **External calendars:** CalDAV / Google / Outlook sync through the Hub.
- **Local AI models:** e.g. Ollama on the PC; the Hub decides which data may go
  to cloud AI vs local AI.

### 6. Authentication (Stage 3)
- You: passkey or password + session on the Hub.
- Apps/agents: per-client tokens, revocable, scoped, stored hashed.
- Secrets never go in this repo or in chat.

## File layout

```
index.html            app shell, screens, auto-update
css/app.css           all styling (3 colour variables + light/dark)
js/db.js              local database (IndexedDB) + activity log
js/ui.js              small DOM / date helpers
js/app.js             navigation, theme, screen rendering
js/screens/*.js       one file per section
sw.js                 offline cache (list every new file in FILES)
version.json          bump with APP_VERSION on every change
docs/                 architecture, data model, roadmap, hub schema
```
