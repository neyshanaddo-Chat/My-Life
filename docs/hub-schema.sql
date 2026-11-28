-- Personal Data Hub — draft PostgreSQL schema (Stage 3, not deployed yet)
-- Mirrors docs/DATA-MODEL.md. Every app and agent goes through the Hub API;
-- nothing connects to these tables directly.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Common columns (repeated per table) ----------
-- id uuid PK, created_at, updated_at, deleted_at, source, rev

CREATE TABLE tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  notes        text,
  priority     text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  due          date,
  category     text,
  goal_id      uuid,
  recur        text NOT NULL DEFAULT 'none' CHECK (recur IN ('none','daily','weekly','monthly')),
  done         boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  extra        jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  source       text NOT NULL,
  rev          integer NOT NULL DEFAULT 1
);

CREATE TABLE goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  why          text,
  horizon      text NOT NULL DEFAULT 'long',
  area         text,
  target_date  date,
  kind         text NOT NULL DEFAULT 'standard',
  milestones   jsonb NOT NULL DEFAULT '[]',
  start_date   date,
  days         jsonb NOT NULL DEFAULT '{}',
  status       text NOT NULL DEFAULT 'active',
  achieved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  source       text NOT NULL,
  rev          integer NOT NULL DEFAULT 1
);

CREATE TABLE notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text,
  body         text NOT NULL DEFAULT '',          -- Markdown (Obsidian-compatible)
  type         text NOT NULL DEFAULT 'note',
  tags         text[] NOT NULL DEFAULT '{}',
  pinned       boolean NOT NULL DEFAULT false,
  obsidian_path text,                             -- set once synced to a vault
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  source       text NOT NULL,
  rev          integer NOT NULL DEFAULT 1
);

CREATE TABLE wellbeing (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date             date NOT NULL UNIQUE,
  happiness        smallint CHECK (happiness BETWEEN 1 AND 5),
  energy           smallint CHECK (energy BETWEEN 1 AND 5),
  sleep_hours      numeric(4,1),
  exercise_minutes integer,
  habits           jsonb NOT NULL DEFAULT '{}',
  good             text,
  hard             text,
  reflection       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  source           text NOT NULL,
  rev              integer NOT NULL DEFAULT 1
);

CREATE TABLE events (                               -- calendar (Stage 2)
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz,
  all_day      boolean NOT NULL DEFAULT false,
  location     text,
  recur_rule   text,                               -- RFC 5545 RRULE
  external_id  text,                               -- id in Google/Outlook/CalDAV
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  source       text NOT NULL,
  rev          integer NOT NULL DEFAULT 1
);

-- ---------- Governance ----------

-- Apps and AI agents that can talk to the Hub
CREATE TABLE clients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,                      -- 'life-manager', 'ai-tos', 'n8n', 'system-terminal'
  kind         text NOT NULL CHECK (kind IN ('app','agent','admin')),
  token_hash   text NOT NULL,                      -- never store the raw token
  enabled      boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

-- What each client may do with each collection
CREATE TABLE permissions (
  client_id    uuid REFERENCES clients(id) ON DELETE CASCADE,
  collection   text NOT NULL,                      -- 'tasks', 'wellbeing', ...
  can_read     boolean NOT NULL DEFAULT false,
  write_mode   text NOT NULL DEFAULT 'none'
               CHECK (write_mode IN ('none','propose','needs_approval','auto')),
  auto_sync    boolean NOT NULL DEFAULT false,
  restricted   boolean NOT NULL DEFAULT false,     -- hard block, overrides everything
  PRIMARY KEY (client_id, collection)
);

-- Proposed changes waiting for your decision
CREATE TABLE proposals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid REFERENCES clients(id),
  collection   text NOT NULL,
  record_id    uuid,
  operation    text NOT NULL CHECK (operation IN ('create','update','delete')),
  payload      jsonb NOT NULL,
  reason       text,                               -- why the app/agent proposes it
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  decided_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Append-only history of every transfer and decision
CREATE TABLE audit_log (
  id           bigserial PRIMARY KEY,
  at           timestamptz NOT NULL DEFAULT now(),
  client_id    uuid REFERENCES clients(id),
  action       text NOT NULL,                      -- read / write / propose / approve / reject / sync
  collection   text,
  record_id    uuid,
  destination  text,
  outcome      text NOT NULL,                      -- ok / denied / error
  detail       jsonb NOT NULL DEFAULT '{}'
);
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;
