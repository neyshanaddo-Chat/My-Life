# My Life — Personal Life Manager

The everyday interface for my Personal Operating System: dashboard, tasks,
goals (including the 100-Day AI Skills Project), notes & journal, and
wellbeing — installable on phone and laptop, works offline.

**Live app:** https://neyshanaddo-chat.github.io/My-Life/

Your data is stored on your own device (IndexedDB), never in this repository.
This repo is public and only holds code — never commit personal data,
passwords or API keys.

- Architecture & decisions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Data model: [docs/DATA-MODEL.md](docs/DATA-MODEL.md)
- Roadmap & open decisions: [docs/ROADMAP.md](docs/ROADMAP.md)
- Future Hub schema: [docs/hub-schema.sql](docs/hub-schema.sql)

## Updating the app
Bump `APP_VERSION` in `index.html` **and** `version.json` on every change, and
add any new file to `FILES` in `sw.js`. Installed apps refresh within seconds.
