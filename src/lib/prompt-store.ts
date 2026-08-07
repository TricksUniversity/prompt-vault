export type Prompt = {
  id: string;
  name: string;
  purpose: string;
  body: string;
  category: string;
  tags: string[];
  model_guidance: string;
  expected_output: string;
  is_favorite: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Version = {
  id: string;
  prompt_id: string;
  name: string;
  purpose: string;
  body: string;
  created_at: string;
};

export const CATEGORIES = [
  "Writing",
  "Coding",
  "Analysis",
  "Research",
  "Marketing",
  "Ops",
];

const KEY = "prompt-lib-mock-v1";

export const extractVars = (body: string): string[] => [
  ...new Set(
    [...body.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map((m) => m[1] ?? ""),
  ),
].filter(Boolean);

export const fillVars = (body: string, values: Record<string, string>) =>
  body.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k: string) => values[k] || m);

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

const now = () => new Date().toISOString();

export type Store = { prompts: Prompt[]; versions: Version[] };

export function makePrompt(p: Partial<Prompt>): Prompt {
  return {
    id: uid(),
    name: "Untitled prompt",
    purpose: "",
    body: "",
    category: "Writing",
    tags: [],
    model_guidance: "",
    expected_output: "",
    is_favorite: false,
    usage_count: 0,
    last_used_at: null,
    created_at: now(),
    updated_at: now(),
    ...p,
  };
}

export function makeVersion(p: Prompt, at?: string): Version {
  return {
    id: uid(),
    prompt_id: p.id,
    name: p.name,
    purpose: p.purpose,
    body: p.body,
    created_at: at ?? now(),
  };
}

export function seed(): Store {
  const prompts = [
    makePrompt({
      name: "Blog post outline",
      purpose: "Turn a rough topic into a structured outline",
      body: "You are an experienced editor.\n\nTopic: {{topic}}\nAudience: {{audience}}\nTone: {{tone}}\n\nProduce a blog outline with an H1, 5 H2 sections, and 2 bullet points under each.",
      category: "Writing",
      tags: ["tested", "daily"],
      model_guidance: "Best on Claude Opus — keeps structure tight.",
      expected_output: "Markdown outline, ~200 words.",
      is_favorite: true,
      usage_count: 34,
      last_used_at: now(),
    }),
    makePrompt({
      name: "Code review pass",
      purpose: "Review a diff for bugs, naming and edge cases",
      body: "Review the following {{language}} code.\n\n```\n{{code}}\n```\n\nList: 1) correctness bugs, 2) edge cases, 3) naming/readability. Be terse.",
      category: "Coding",
      tags: ["tested", "few-shot"],
      model_guidance: "GPT-4 class or better.",
      expected_output: "Three numbered lists.",
      usage_count: 21,
      last_used_at: now(),
    }),
    makePrompt({
      name: "Dataset summary",
      purpose: "Explain a table of numbers in plain language",
      body: "Summarize this dataset for a {{audience}} audience.\n\n{{data}}\n\nCall out the three most surprising findings.",
      category: "Analysis",
      tags: ["daily"],
      usage_count: 8,
    }),
    makePrompt({
      name: "Cold outreach email",
      purpose: "Short, non-spammy intro email",
      body: "Write a 90-word intro email from {{sender}} at {{company}} to {{recipient}}.\nHook: {{hook}}\nOne clear call to action. No exclamation marks.",
      category: "Marketing",
      tags: ["draft"],
      usage_count: 3,
    }),
  ];
  return { prompts, versions: prompts.map((p) => makeVersion(p, p.created_at)) };
}

export function loadStore(): Store {
  if (typeof window === "undefined") return { prompts: [], versions: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* ignore */
  }
  const s = seed();
  saveStore(s);
  return s;
}

export function saveStore(s: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}
