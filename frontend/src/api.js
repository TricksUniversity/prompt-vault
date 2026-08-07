const BASE = import.meta.env.VITE_API_URL || "";

async function req(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
  return res.status === 204 ? null : res.json();
}

export const api = {
  list: (params) => req("GET", `/api/prompts?${new URLSearchParams(params)}`),
  meta: () => req("GET", "/api/meta"),
  create: (p) => req("POST", "/api/prompts", p),
  update: (id, p) => req("PUT", `/api/prompts/${id}`, p),
  remove: (id) => req("DELETE", `/api/prompts/${id}`),
  favorite: (id) => req("PATCH", `/api/prompts/${id}/favorite`),
  use: (id) => req("POST", `/api/prompts/${id}/use`),
  duplicate: (id) => req("POST", `/api/prompts/${id}/duplicate`),
  versions: (id) => req("GET", `/api/prompts/${id}/versions`),
  restore: (id, vid) => req("POST", `/api/prompts/${id}/restore/${vid}`),
  exportAll: () => req("GET", "/api/export"),
  importAll: (prompts) => req("POST", "/api/import", { prompts }),
};
