# Data model

Stage 1 stores these collections in IndexedDB on the device. The Hub
(`hub-schema.sql`) uses the same names and fields, so syncing is a direct copy.

## Fields on every record

| Field        | Meaning                                              |
|--------------|------------------------------------------------------|
| `id`         | UUID, created on the device                          |
| `created_at` | ISO timestamp                                        |
| `updated_at` | ISO timestamp, changes on every edit (used for sync) |
| `deleted_at` | ISO timestamp or null (soft delete)                  |
| `source`     | which app created it (`life-manager` for now)        |
| `rev`        | edit counter, increments on every change             |

## Collections

**tasks** — `title`, `notes`, `priority` (`low` / `normal` / `high`),
`due` (date), `category`, `goal_id`, `recur` (`none` / `daily` / `weekly` /
`monthly`), `done`, `completed_at`.
Completing a recurring task marks it done (kept as history) and creates the
next occurrence.

**goals** — `title`, `why`, `horizon` (`long` / `short`), `area`,
`target_date`, `milestones` `[{id, title, done}]`, `status`
(`active` / `achieved` / `paused`), `achieved_at`, `kind`
(`standard` / `hundred_day`). Hundred-day goals also have `start_date` and
`days` `{ "YYYY-MM-DD": { done, note } }`.

**notes** — `title`, `body` (Markdown), `type`
(`note` / `idea` / `journal` / `reflection`), `tags` `[]`, `pinned`.

**wellbeing** — one per day, `date` (YYYY-MM-DD, unique), `happiness` (1–5),
`energy` (1–5), `sleep_hours`, `exercise_minutes`, `habits` `{name: true}`,
`good`, `hard`, `reflection`.

**activity** — append-only log of changes on this device: `at`, `action`
(`created` / `updated` / `completed` / `deleted` / …), `collection`,
`record_id`, `summary`. Becomes the device side of the Hub's audit log.

**settings** — key/value: `name`, `habits` (list of habit names to track),
`theme`.

## Privacy

Wellbeing entries and journals are personal. They stay on the device until a
Hub exists, and the Hub's default permission for wellbeing and journal data
will be **restricted** for every app and agent until you change it.
