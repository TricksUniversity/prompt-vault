import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const EMPTY = {
  name: "",
  purpose: "",
  body: "",
  category: "Writing",
  tags: [],
  model_guidance: "",
  expected_output: "",
};

const CATEGORIES = ["Writing", "Coding", "Analysis", "Research", "Marketing", "Ops"];

export const extractVars = (body = "") => [
  ...new Set([...body.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map((m) => m[1])),
];

export const fillVars = (body = "", values = {}) =>
  body.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => values[k] || m);

export default function App() {
  const [prompts, setPrompts] = useState([]);
  const [meta, setMeta] = useState({ categories: [], tags: [] });
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [versions, setVersions] = useState([]);
  const [values, setValues] = useState({});
  const [dark, setDark] = useState(
    () => localStorage.getItem("pl-theme") !== "light",
  );
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("pl-theme", dark ? "dark" : "light");
  }, [dark]);

  const say = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 1800);
  };

  const load = useCallback(async () => {
    const params = {};
    if (q) params.q = q;
    if (category) params.category = category;
    if (tag) params.tag = tag;
    if (favOnly) params.favorites = "true";
    const [list, m] = await Promise.all([api.list(params), api.meta()]);
    setPrompts(list);
    setMeta(m);
  }, [q, category, tag, favOnly]);

  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
  }, [load]);

  const open = async (p) => {
    setSelected(p);
    setEditing(null);
    setValues({});
    setVersions(await api.versions(p.id));
  };

  const save = async (draft) => {
    const saved = draft.id
      ? await api.update(draft.id, draft)
      : await api.create(draft);
    setEditing(null);
    await load();
    await open(saved);
    say("Saved");
  };

  const copy = async (p) => {
    await navigator.clipboard.writeText(fillVars(p.body, values));
    const updated = await api.use(p.id);
    setSelected(updated);
    await load();
    say("Copied to clipboard");
  };

  const doExport = async () => {
    const doc = await api.exportAll();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "prompts.json";
    a.click();
    URL.revokeObjectURL(url);
    say("Exported");
  };

  const doImport = async (file) => {
    const doc = JSON.parse(await file.text());
    const res = await api.importAll(doc.prompts || doc);
    await load();
    say(`Imported ${res.imported}`);
  };

  const vars = useMemo(() => extractVars(selected?.body), [selected]);

  return (
    <div className="min-h-full bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight">Prompt Library</h1>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search prompts…"
            className="ml-4 w-72 rounded-md border border-neutral-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
          />
          <button
            onClick={() => setFavOnly((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-sm ${favOnly ? "border-amber-400 text-amber-500" : "border-neutral-300 dark:border-neutral-700"}`}
          >
            ★ Favorites
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={doExport} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
              Export
            </button>
            <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
              Import
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => e.target.files[0] && doImport(e.target.files[0])}
              />
            </label>
            <button onClick={() => setDark((d) => !d)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
              {dark ? "☀" : "☾"}
            </button>
            <button
              onClick={() => {
                setSelected(null);
                setEditing({ ...EMPTY });
              }}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              New prompt
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 pb-3 text-xs">
          <Chip active={!category} onClick={() => setCategory("")}>All categories</Chip>
          {meta.categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c === category ? "" : c)}>{c}</Chip>
          ))}
          {meta.tags.map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setTag(t === tag ? "" : t)}>#{t}</Chip>
          ))}
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 lg:grid-cols-[380px_1fr]">
        <ul className="space-y-2">
          {prompts.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => open(p)}
                className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === p.id ? "border-neutral-900 dark:border-white" : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {p.is_favorite && <span className="text-amber-500">★</span>}
                  <span className="ml-auto text-xs opacity-60">{p.usage_count} uses</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm opacity-70">{p.purpose}</p>
                <div className="mt-2 flex flex-wrap gap-1 text-[11px] opacity-70">
                  <span className="rounded bg-neutral-200 px-1.5 py-0.5 dark:bg-neutral-800">{p.category}</span>
                  {p.tags.map((t) => (
                    <span key={t} className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800/60">#{t}</span>
                  ))}
                </div>
              </button>
            </li>
          ))}
          {!prompts.length && <p className="p-6 text-center text-sm opacity-60">No prompts yet.</p>}
        </ul>

        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          {editing ? (
            <Editor
              draft={editing}
              onChange={setEditing}
              onCancel={() => setEditing(null)}
              onSave={() => save(editing)}
            />
          ) : selected ? (
            <Detail
              p={selected}
              vars={vars}
              values={values}
              setValues={setValues}
              versions={versions}
              onEdit={() => setEditing({ ...selected })}
              onCopy={() => copy(selected)}
              onFav={async () => {
                setSelected(await api.favorite(selected.id));
                load();
              }}
              onDuplicate={async () => {
                await api.duplicate(selected.id);
                load();
                say("Duplicated");
              }}
              onDelete={async () => {
                await api.remove(selected.id);
                setSelected(null);
                load();
                say("Deleted");
              }}
              onRestore={async (vid) => {
                const p = await api.restore(selected.id, vid);
                await open(p);
                load();
                say("Restored");
              }}
            />
          ) : (
            <p className="p-10 text-center text-sm opacity-60">Select a prompt or create a new one.</p>
          )}
        </section>
      </main>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white shadow dark:bg-white dark:text-neutral-900">
          {toast}
        </div>
      )}
    </div>
  );
}

function Chip({ active, children, ...rest }) {
  return (
    <button
      {...rest}
      className={`rounded-full border px-2.5 py-1 ${active ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900" : "border-neutral-300 dark:border-neutral-700"}`}
    >
      {children}
    </button>
  );
}

const field =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700";

function Editor({ draft, onChange, onSave, onCancel }) {
  const set = (k) => (e) => onChange({ ...draft, [k]: e.target.value });
  return (
    <div className="space-y-3">
      <input className={field} placeholder="Name" value={draft.name} onChange={set("name")} />
      <input className={field} placeholder="Purpose (one line)" value={draft.purpose} onChange={set("purpose")} />
      <textarea
        className={`${field} min-h-56 font-mono`}
        placeholder="Prompt body — use {{variables}}"
        value={draft.body}
        onChange={set("body")}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <select className={field} value={draft.category} onChange={set("category")}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          className={field}
          placeholder="tags, comma separated"
          value={draft.tags.join(", ")}
          onChange={(e) =>
            onChange({
              ...draft,
              tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
            })
          }
        />
        <input className={field} placeholder="Model guidance" value={draft.model_guidance} onChange={set("model_guidance")} />
        <input className={field} placeholder="Expected output" value={draft.expected_output} onChange={set("expected_output")} />
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-neutral-900">Save</button>
        <button onClick={onCancel} className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">Cancel</button>
      </div>
    </div>
  );
}

function Detail({ p, vars, values, setValues, versions, onEdit, onCopy, onFav, onDelete, onDuplicate, onRestore }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <div>
          <h2 className="text-xl font-semibold">{p.name}</h2>
          <p className="text-sm opacity-70">{p.purpose}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={onFav} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">{p.is_favorite ? "★" : "☆"}</button>
          <button onClick={onEdit} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">Edit</button>
          <button onClick={onDuplicate} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">Duplicate</button>
          <button onClick={onDelete} className="rounded-md border border-red-400 px-3 py-1.5 text-sm text-red-500">Delete</button>
        </div>
      </div>

      {vars.length > 0 && (
        <div className="grid gap-2 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
          {vars.map((v) => (
            <label key={v} className="text-xs opacity-80">
              {v}
              <input
                className={field}
                value={values[v] || ""}
                onChange={(e) => setValues({ ...values, [v]: e.target.value })}
              />
            </label>
          ))}
        </div>
      )}

      <pre className="whitespace-pre-wrap rounded-md bg-neutral-100 p-3 font-mono text-sm dark:bg-neutral-900">
        {fillVars(p.body, values)}
      </pre>

      <button onClick={onCopy} className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-neutral-900">
        Copy to clipboard
      </button>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        {p.model_guidance && <Info label="Model guidance">{p.model_guidance}</Info>}
        {p.expected_output && <Info label="Expected output">{p.expected_output}</Info>}
        <Info label="Usage">{p.usage_count} copies · last {p.last_used_at ? new Date(p.last_used_at).toLocaleString() : "never"}</Info>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Version history</h3>
        <ul className="space-y-1 text-sm">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center gap-2 rounded border border-neutral-200 px-2 py-1 dark:border-neutral-800">
              <span className="opacity-70">{new Date(v.created_at).toLocaleString()}</span>
              <span className="truncate opacity-60">{v.name}</span>
              <button onClick={() => onRestore(v.id)} className="ml-auto text-xs underline">Restore</button>
            </li>
          ))}
          {!versions.length && <li className="opacity-60">No versions yet.</li>}
        </ul>
      </div>
    </div>
  );
}

function Info({ label, children }) {
  return (
    <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
