# Features — keep / skip rationale

## Keep — v1 core (must-have)

| # | Feature | Why it's in |
|---|---------|-------------|
| 1 | Prompt body | The product. Everything else is metadata around it. |
| 2 | Name / title | Without a human label you can't find anything past ~20 prompts. |
| 3 | Purpose (one-liner) | Tells you *when* to reach for a prompt without reading the body. |
| 4 | `{{variables}}` | Prompts are templates. Auto-detection means zero extra bookkeeping. |
| 5 | Categories (task-based) | Task ("Coding", "Analysis") stays stable; model-based folders rot. |
| 6 | Tags | Cross-cutting truth: `tested`, `few-shot`, `daily`, model names. |
| 7 | Full-text search | Postgres FTS over name+purpose+tags+body. The real navigation. |
| 8 | Copy-to-clipboard | The single most-used action; must be one click. |
| 9 | CRUD | A library you can't edit fast becomes a graveyard. |
| 10 | Local persistence | Host bind mount → rebuilds never wipe data. |

## Keep — nice-to-have (shipped in this build)

| # | Feature | Why it's in |
|---|---------|-------------|
| 11 | Variable-fill form + live preview | Turns a template into a finished prompt without hand-editing. |
| 12 | Version history + restore | Prompt iteration is lossy; snapshots make experimentation safe. |
| 13 | Expected output / example | Documents what "working" looks like when you revisit in 3 months. |
| 14 | Model guidance | "Best on Opus" is real, cheap knowledge worth one text field. |
| 15 | Favorites / pin | 90% of use comes from ~10 prompts. |
| 16 | Import / export JSON | Backup + portability without touching Postgres. |
| 17 | Usage count + last used | Enables monthly pruning based on evidence, not vibes. |
| 18 | Duplicate | Fork-and-tweak is the natural iteration loop. |
| 19 | Dark mode | It runs all day next to an editor. |

## Skip — explicitly out of scope

| Feature | Why it's out |
|---------|--------------|
| Auth / login | Single user, localhost only. Auth adds risk and zero value. |
| Multi-user, ownership, roles | Nobody else uses this instance. |
| Sharing / public links | Would require exposing the service beyond localhost. |
| Approval workflows | Governance overhead for a library of one. |
| Cloud sync | Violates the local-only constraint; export covers portability. |
| A/B eval pipelines | Real work, separate product. Version history covers iteration. |
| Serving prompts over an API to other apps | Turns a library into infrastructure with uptime obligations. |
| Analytics dashboards | `usage_count` + `last_used_at` in the list is enough signal. |
