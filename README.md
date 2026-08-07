# Prompt Library

A **self-hosted, local, single-user** prompt library. No auth, no multi-user, no cloud —
all data lives on your machine.

React + Vite + Tailwind (nginx) · Node.js + Express · PostgreSQL 16 · Docker Compose.

---

## Ports (base 6060)

| Host port | Service | Container |
|-----------|---------|-----------|
| **6060** | Web UI (nginx) | 80 |
| **6061** | Backend API | 3000 |
| **6062** | PostgreSQL | 5432 |

- UI → http://localhost:6060
- API health → `curl localhost:6061/health` → `200 ok`
- DB → `psql postgres://promptlib:promptlib@localhost:6062/promptlib`

---

## Start / stop / rebuild

```bash
./scripts/start.sh     # docker compose up -d --build
./scripts/stop.sh      # docker compose down (containers only, data kept)
./scripts/restart.sh   # down + up -d --build
./scripts/logs.sh      # docker compose logs -f
./scripts/backup.sh    # timestamped copy of the data folder
./scripts/smoke.sh     # API smoke test against a live deploy
./scripts/reset-db.sh  # DESTRUCTIVE — deletes postgres/, asks first
```

Make them executable once: `chmod +x scripts/*.sh`

---

## Where data lives

```
/Users/narendra.bagul/Code/POC/Tools/shared-data/prompt-lib/
├── postgres/   ← Postgres data directory (the database)
└── exports/    ← JSON export/backup files
```

Both are **host bind mounts**. The containers are disposable; the data is not.

### Rebuild safety guarantee

`docker compose down`, `up`, and `up --build` all remount the same host directory,
so **rebuilding and restarting never wipes your prompts**. The *only* destructive
actions are deleting that host folder manually or running `scripts/reset-db.sh`
(which requires typing `DELETE` to confirm).

Verify it yourself:

1. `docker compose up -d --build`
2. Create a prompt named "Test Survivor" in the UI.
3. `docker compose down && docker compose up -d --build`
4. "Test Survivor" is still listed.
5. `ls -la /Users/narendra.bagul/Code/POC/Tools/shared-data/prompt-lib/postgres`
6. Restart Docker Desktop — `restart: unless-stopped` brings the stack back, data intact.

---

## Backup / restore

- **Folder copy:** `./scripts/backup.sh` (or copy `shared-data/prompt-lib` anywhere).
  Restore by stopping the stack and copying the folder back.
- **In-app:** *Export* downloads a JSON file (also written to `exports/`);
  *Import* re-uploads it.

---

## Memory footprint

| Service | `mem_limit` |
|---------|-------------|
| db | 384m |
| api | 256m |
| web | 128m |
| **Total** | **~768m** |

Safe to leave running 24×7. `restart: unless-stopped` means containers return after
a reboot but stay down if you deliberately stopped them.

---

## Features

Prompt body · name · purpose · `{{variables}}` auto-detected · task categories · tags ·
Postgres full-text search · copy-to-clipboard · full CRUD · variable-fill form with live
preview · version history with restore · expected output · model guidance · favorites ·
JSON import/export · usage count + last-used · duplicate · dark mode.

Out of scope by design: auth, multi-user, sharing, approvals, cloud sync, eval pipelines,
dashboards. See [FEATURES.md](FEATURES.md).

---

## API reference

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | liveness + DB ping |
| GET | `/api/prompts?q=&category=&tag=&favorites=` | list / search / filter |
| GET | `/api/meta` | distinct categories + tags |
| POST | `/api/prompts` | create |
| PUT | `/api/prompts/:id` | update (snapshots prior version) |
| DELETE | `/api/prompts/:id` | delete |
| PATCH | `/api/prompts/:id/favorite` | toggle star |
| POST | `/api/prompts/:id/use` | increment usage_count, stamp last_used_at |
| POST | `/api/prompts/:id/duplicate` | copy |
| GET | `/api/prompts/:id/versions` | version list |
| POST | `/api/prompts/:id/restore/:versionId` | restore a version |
| GET | `/api/export` | JSON download + write to `exports/` |
| POST | `/api/import` | `{ prompts: [...] }` |

---

## Post-deploy smoke checklist

Run after every `docker compose up -d --build`:

- [ ] UI loads at :6060 with no console errors
- [ ] `curl localhost:6061/health` → `200 ok`
- [ ] Create prompt — saves and appears in list
- [ ] Search filters instantly
- [ ] Category and tag filters work
- [ ] Edit persists after reload
- [ ] `{{vars}}` produce inputs; preview updates
- [ ] Copy button copies filled text; `usage_count` increments
- [ ] Edit creates a version; restore works
- [ ] Star toggles; favorites filter works
- [ ] Export downloads JSON and lands in `exports/`
- [ ] Import restores prompts
- [ ] Delete removes prompt
- [ ] Dark mode toggles

`./scripts/smoke.sh` automates health, create, search, usage and delete.

---

## Troubleshooting

**Port already in use** — `lsof -i :6060` (or 6061/6062), stop the other process, or
change the left-hand side of the port mappings in `docker-compose.yml`.

**API can't reach the DB** — `docker compose logs api db`. The API retries migrations
for ~30s while Postgres starts; the healthcheck should flip `db` to healthy within 10–20s.

**Permission errors on the bind mount** — make sure the host folder exists and Docker
Desktop has file-sharing access to `/Users/narendra.bagul/Code`.

**UI loads but list is empty / network errors** — nginx proxies `/api` to the `api`
container; check `docker compose logs web api`.

**Start over** — `./scripts/reset-db.sh` (destructive, confirms first).
