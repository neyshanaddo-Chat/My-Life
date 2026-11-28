# Roadmap

Build in small stages. Each stage should be usable on its own before the next
one starts.

## Stage 1 — Foundation you can use (current)
- [x] Installable app shell (app-starter): header, side menu, 3 colours,
      light/dark, auto-update, offline. Menu stays open on wide screens.
- [x] Local database on the device with sync-ready records + activity log
- [x] Dashboard: today, due/overdue tasks, check-in, goals, recent activity
- [x] Tasks: add, edit, complete, priorities, due dates, categories,
      recurring, completed history
- [x] Goals: long/short-term, milestones, progress, achieved history,
      100-Day AI Skills Project tracker
- [x] Notes & journal: notes, ideas, journal, reflections, tags, search
- [x] Wellbeing: daily check-in (happiness, energy, sleep, exercise, habits,
      good/hard moments, reflection) + 14-day trends
- [x] Settings: name, appearance, habits list, backup export/import
- [ ] Calendar, Connected Apps, Sync Centre — placeholders only

## Stage 2 — Calendar and polish
- Calendar with day / week / month views, create/edit events, reminders
- Dashboard "upcoming commitments" from calendar
- Notifications for reminders (where the device allows)
- Feedback-driven polish from a week or two of real use

## Stage 3 — Personal Data Hub
- PostgreSQL + TypeScript API in Docker (`docs/hub-schema.sql`)
- Your login; per-app / per-agent tokens with scopes
- Life Manager syncs to the Hub (two-way, offline-tolerant)
- Sync & Verification Centre becomes live: permissions, proposals,
  approve/reject, transfer history — enforced by the Hub

## Stage 4 — Connections
- Obsidian vault sync, external calendar sync, n8n, clock app, to-do app

## Stage 5 — AI layer
- Claude / OpenAI / AI-TOS / local model as agents with `propose` access
- Insights: wellbeing patterns, neglected goals, schedule help, note search

## Later — Application Two: System Terminal
- Separate app using the same Hub API with an admin scope.

## Open decisions (need your input before Stage 3)
1. **Where the Hub runs:** your Windows PC (most private, only reachable when
   it's on) or your Hostinger VPS (always reachable from your phone), or both.
2. **Backups:** where encrypted backups should go.
