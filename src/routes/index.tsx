import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CATEGORIES,
  extractVars,
  fillVars,
  loadStore,
  makePrompt,
  makeVersion,
  saveStore,
  type Prompt,
  uid,
  type Store,
  type Version,
} from "@/lib/prompt-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prompt Library — Local, Single-User Prompt Manager" },
      {
        name: "description",
        content:
          "Self-hosted prompt library with full-text search, {{variable}} fill, version history, favorites and JSON import/export.",
      },
      { property: "og:title", content: "Prompt Library — Local Prompt Manager" },
      {
        property: "og:description",
        content:
          "Search, template and version your AI prompts. Runs entirely on your machine via Docker.",
      },
    ],
  }),
  component: PromptLibrary,
});

const EMPTY = {
  name: "",
  purpose: "",
  body: "",
  category: "Writing",
  tags: [] as string[],
  model_guidance: "",
  expected_output: "",
};

type Draft = Partial<Prompt> & typeof EMPTY;

function PromptLibrary() {
  const [store, setStore] = useState<Store>({ prompts: [], versions: [] });
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const s = loadStore();
    setStore(s);
    setSelectedId(s.prompts[0]?.id ?? null);
    setDark(localStorage.getItem("pl-theme") === "dark");
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("pl-theme", dark ? "dark" : "light");
  }, [dark, ready]);

  const commit = (s: Store) => {
    setStore(s);
    saveStore(s);
  };
  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 1800);
  };

  const categories = useMemo(
    () => [...new Set(store.prompts.map((p) => p.category))].sort(),
    [store],
  );
  const tags = useMemo(
    () => [...new Set(store.prompts.flatMap((p) => p.tags))].sort(),
    [store],
  );

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return store.prompts
      .filter((p) => {
        if (favOnly && !p.is_favorite) return false;
        if (category && p.category !== category) return false;
        if (tag && !p.tags.includes(tag)) return false;
        if (!needle) return true;
        return [p.name, p.purpose, p.body, p.tags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort(
        (a, b) =>
          Number(b.is_favorite) - Number(a.is_favorite) ||
          b.updated_at.localeCompare(a.updated_at),
      );
  }, [store, q, category, tag, favOnly]);

  const selected = store.prompts.find((p) => p.id === selectedId) ?? null;
  const versions: Version[] = store.versions
    .filter((v) => v.prompt_id === selectedId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const vars = useMemo(() => extractVars(selected?.body ?? ""), [selected]);

  const save = () => {
    if (!draft?.name?.trim()) return say("Name is required");
    if (draft.id) {
      const prev = store.prompts.find((p) => p.id === draft.id)!;
      const updated: Prompt = {
        ...prev,
        ...draft,
        updated_at: new Date().toISOString(),
      } as Prompt;
      commit({
        prompts: store.prompts.map((p) => (p.id === updated.id ? updated : p)),
        versions: [...store.versions, makeVersion(prev)],
      });
      setSelectedId(updated.id);
    } else {
      const created = makePrompt(draft);
      commit({
        prompts: [created, ...store.prompts],
        versions: [...store.versions, makeVersion(created)],
      });
      setSelectedId(created.id);
    }
    setDraft(null);
    setValues({});
    say("Saved");
  };

  const patch = (p: Prompt, changes: Partial<Prompt>) =>
    commit({
      ...store,
      prompts: store.prompts.map((x) =>
        x.id === p.id ? { ...x, ...changes } : x,
      ),
    });

  const copy = async (p: Prompt) => {
    const text = fillVars(p.body, values);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked in preview */
    }
    patch(p, {
      usage_count: p.usage_count + 1,
      last_used_at: new Date().toISOString(),
    });
    say("Copied to clipboard");
  };

  const exportJson = () => {
    const doc = { exported_at: new Date().toISOString(), prompts: store.prompts };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "prompts.json";
    a.click();
    URL.revokeObjectURL(url);
    say("Exported prompts.json");
  };

  const importJson = async (file: File) => {
    try {
      const doc = JSON.parse(await file.text());
      const items: Prompt[] = (doc.prompts ?? doc).map((p: Partial<Prompt>) =>
        makePrompt(p),
      );
      commit({
        prompts: [...items, ...store.prompts],
        versions: [...store.versions, ...items.map((p) => makeVersion(p))],
      });
      say(`Imported ${items.length}`);
    } catch {
      say("Invalid JSON file");
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">
              {"{}"}
            </span>
            <h1 className="text-base font-semibold tracking-tight">
              Prompt Library
            </h1>
            <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              localhost:6060
            </span>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, purpose, body, tags…"
            className="h-9 min-w-56 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring"
          />

          <div className="flex items-center gap-2">
            <Btn active={favOnly} onClick={() => setFavOnly((v) => !v)}>
              ★ Favorites
            </Btn>
            <Btn onClick={exportJson}>Export</Btn>
            <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border px-3 text-sm hover:bg-accent">
              Import
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && importJson(e.target.files[0])
                }
              />
            </label>
            <Btn onClick={() => setDark((d) => !d)}>{dark ? "☀" : "☾"}</Btn>
            <button
              onClick={() => {
                setDraft({ ...EMPTY });
                setSelectedId(null);
              }}
              className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              New prompt
            </button>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 px-5 pb-3 text-xs">
          <Chip active={!category && !tag} onClick={() => { setCategory(""); setTag(""); }}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c}
              active={category === c}
              onClick={() => setCategory(category === c ? "" : c)}
            >
              {c}
            </Chip>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          {tags.map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? "" : t)}>
              #{t}
            </Chip>
          ))}
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-5 px-5 py-5 lg:grid-cols-[360px_1fr]">
        <ul className="space-y-2">
          {list.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  setSelectedId(p.id);
                  setDraft(null);
                  setValues({});
                }}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selectedId === p.id
                    ? "border-primary bg-accent"
                    : "border-border hover:border-ring"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{p.name}</span>
                  {p.is_favorite && <span className="text-chart-5">★</span>}
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                    {p.usage_count}×
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {p.purpose || "No purpose set"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                    {p.category}
                  </span>
                  {p.tags.map((t) => (
                    <span key={t} className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                      #{t}
                    </span>
                  ))}
                </div>
              </button>
            </li>
          ))}
          {!list.length && (
            <li className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No prompts match.
            </li>
          )}
        </ul>

        <section className="rounded-xl border border-border bg-card p-5">
          {draft ? (
            <Editor
              draft={draft}
              setDraft={setDraft}
              onSave={save}
              onCancel={() => setDraft(null)}
            />
          ) : selected ? (
            <Detail
              p={selected}
              vars={vars}
              values={values}
              setValues={setValues}
              versions={versions}
              onEdit={() => setDraft({ ...EMPTY, ...selected })}
              onCopy={() => copy(selected)}
              onFav={() => patch(selected, { is_favorite: !selected.is_favorite })}
              onDuplicate={() => {
                const dup = makePrompt({
                  ...selected,
                  id: uid(),
                  name: `${selected.name} (copy)`,
                  usage_count: 0,
                  last_used_at: null,
                });
                commit({
                  prompts: [dup, ...store.prompts],
                  versions: [...store.versions, makeVersion(dup)],
                });
                setSelectedId(dup.id);
                say("Duplicated");
              }}
              onDelete={() => {
                commit({
                  prompts: store.prompts.filter((p) => p.id !== selected.id),
                  versions: store.versions.filter((v) => v.prompt_id !== selected.id),
                });
                setSelectedId(null);
                say("Deleted");
              }}
              onRestore={(v) => {
                patch(selected, {
                  name: v.name,
                  purpose: v.purpose,
                  body: v.body,
                  updated_at: new Date().toISOString(),
                });
                commit({
                  prompts: store.prompts.map((p) =>
                    p.id === selected.id
                      ? { ...p, name: v.name, purpose: v.purpose, body: v.body }
                      : p,
                  ),
                  versions: [...store.versions, makeVersion(selected)],
                });
                say("Version restored");
              }}
            />
          ) : (
            <p className="p-16 text-center text-sm text-muted-foreground">
              Select a prompt, or create a new one.
            </p>
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-7xl px-5 pb-8 text-xs text-muted-foreground">
        Mock preview of the Docker build · UI :6060 · API :6061 · Postgres :6062 ·
        data persisted to a host bind mount.
      </footer>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function Btn({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-9 rounded-md border px-3 text-sm transition ${
        active
          ? "border-chart-5 text-chart-5"
          : "border-border hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

const field =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring";

function Editor({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const vars = extractVars(draft.body);
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {draft.id ? "Edit prompt" : "New prompt"}
      </h2>
      <input
        className={field}
        placeholder="Name"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />
      <input
        className={field}
        placeholder="Purpose — one line"
        value={draft.purpose}
        onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
      />
      <textarea
        className={`${field} min-h-56 font-mono leading-relaxed`}
        placeholder={"Prompt body — use {{variables}}"}
        value={draft.body}
        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
      />
      {vars.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Detected variables: {vars.map((v) => `{{${v}}}`).join(", ")}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          className={field}
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          className={field}
          placeholder="tags, comma separated"
          value={draft.tags.join(", ")}
          onChange={(e) =>
            setDraft({
              ...draft,
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
        />
        <input
          className={field}
          placeholder="Model guidance (optional)"
          value={draft.model_guidance}
          onChange={(e) => setDraft({ ...draft, model_guidance: e.target.value })}
        />
        <input
          className={field}
          placeholder="Expected output (optional)"
          value={draft.expected_output}
          onChange={(e) => setDraft({ ...draft, expected_output: e.target.value })}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Detail({
  p,
  vars,
  values,
  setValues,
  versions,
  onEdit,
  onCopy,
  onFav,
  onDelete,
  onDuplicate,
  onRestore,
}: {
  p: Prompt;
  vars: string[];
  values: Record<string, string>;
  setValues: (v: Record<string, string>) => void;
  versions: Version[];
  onEdit: () => void;
  onCopy: () => void;
  onFav: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRestore: (v: Version) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">{p.name}</h2>
          <p className="text-sm text-muted-foreground">{p.purpose}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Btn onClick={onFav} active={p.is_favorite}>
            {p.is_favorite ? "★ Favorited" : "☆ Favorite"}
          </Btn>
          <Btn onClick={onEdit}>Edit</Btn>
          <Btn onClick={onDuplicate}>Duplicate</Btn>
          <button
            onClick={onDelete}
            className="h-9 rounded-md border border-destructive px-3 text-sm text-destructive hover:bg-destructive/10"
          >
            Delete
          </button>
        </div>
      </div>

      {vars.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fill variables
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {vars.map((v) => (
              <label key={v} className="block text-xs text-muted-foreground">
                <span className="font-mono">{`{{${v}}}`}</span>
                <input
                  className={`${field} mt-1`}
                  value={values[v] ?? ""}
                  onChange={(e) => setValues({ ...values, [v]: e.target.value })}
                  placeholder={v}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-sm leading-relaxed">
        {fillVars(p.body, values)}
      </pre>

      <button
        onClick={onCopy}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Copy to clipboard
      </button>

      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <Info label="Model guidance">{p.model_guidance || "—"}</Info>
        <Info label="Expected output">{p.expected_output || "—"}</Info>
        <Info label="Usage">
          {p.usage_count} copies · last{" "}
          {p.last_used_at ? new Date(p.last_used_at).toLocaleString() : "never"}
        </Info>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Version history
        </h3>
        <ul className="space-y-1">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(v.created_at).toLocaleString()}
              </span>
              <span className="truncate text-muted-foreground">{v.name}</span>
              <button
                onClick={() => onRestore(v)}
                className="ml-auto text-xs underline hover:no-underline"
              >
                Restore
              </button>
            </li>
          ))}
          {!versions.length && (
            <li className="text-sm text-muted-foreground">No versions yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
