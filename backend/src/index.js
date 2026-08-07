import fs from "node:fs/promises";
import path from "node:path";
import cors from "cors";
import express from "express";
import { migrate, pool } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const EXPORT_DIR = process.env.EXPORT_DIR || "/data/exports";

const COLUMNS = `id, name, purpose, body, category, tags, model_guidance,
  expected_output, is_favorite, usage_count, last_used_at, created_at, updated_at`;

app.get("/health", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.status(200).send("ok");
  } catch {
    res.status(500).send("db unavailable");
  }
});

// LIST + SEARCH + FILTER
app.get("/api/prompts", async (req, res, next) => {
  try {
    const { q, category, tag, favorites } = req.query;
    const where = [];
    const params = [];

    if (q) {
      params.push(q);
      where.push(
        `(search_tsv @@ plainto_tsquery('english', $${params.length})
          OR name ILIKE '%' || $${params.length} || '%'
          OR body ILIKE '%' || $${params.length} || '%')`,
      );
    }
    if (category) {
      params.push(category);
      where.push(`category = $${params.length}`);
    }
    if (tag) {
      params.push(tag);
      where.push(`$${params.length} = ANY(tags)`);
    }
    if (favorites === "true") where.push("is_favorite = true");

    const sql = `SELECT ${COLUMNS} FROM prompts
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY is_favorite DESC, updated_at DESC`;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

app.get("/api/meta", async (_req, res, next) => {
  try {
    const cats = await pool.query(
      "SELECT DISTINCT category FROM prompts WHERE category <> '' ORDER BY 1",
    );
    const tags = await pool.query(
      "SELECT DISTINCT unnest(tags) AS tag FROM prompts ORDER BY 1",
    );
    res.json({
      categories: cats.rows.map((r) => r.category),
      tags: tags.rows.map((r) => r.tag),
    });
  } catch (e) {
    next(e);
  }
});

app.get("/api/prompts/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM prompts WHERE id = $1`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

function payload(b) {
  return [
    b.name,
    b.purpose ?? "",
    b.body ?? "",
    b.category ?? "Uncategorized",
    Array.isArray(b.tags) ? b.tags : [],
    b.model_guidance ?? "",
    b.expected_output ?? "",
    !!b.is_favorite,
  ];
}

app.post("/api/prompts", async (req, res, next) => {
  try {
    if (!req.body?.name) return res.status(400).json({ error: "name required" });
    const { rows } = await pool.query(
      `INSERT INTO prompts (name, purpose, body, category, tags, model_guidance,
        expected_output, is_favorite)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${COLUMNS}`,
      payload(req.body),
    );
    const p = rows[0];
    await pool.query(
      "INSERT INTO prompt_versions (prompt_id, name, purpose, body) VALUES ($1,$2,$3,$4)",
      [p.id, p.name, p.purpose, p.body],
    );
    res.status(201).json(p);
  } catch (e) {
    next(e);
  }
});

app.put("/api/prompts/:id", async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const prev = await client.query(
      "SELECT name, purpose, body FROM prompts WHERE id = $1",
      [req.params.id],
    );
    if (!prev.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "not found" });
    }
    // keep prior version snapshot
    await client.query(
      "INSERT INTO prompt_versions (prompt_id, name, purpose, body) VALUES ($1,$2,$3,$4)",
      [req.params.id, prev.rows[0].name, prev.rows[0].purpose, prev.rows[0].body],
    );
    const { rows } = await client.query(
      `UPDATE prompts SET name=$1, purpose=$2, body=$3, category=$4, tags=$5,
        model_guidance=$6, expected_output=$7, is_favorite=$8, updated_at=now()
       WHERE id=$9 RETURNING ${COLUMNS}`,
      [...payload(req.body), req.params.id],
    );
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    next(e);
  } finally {
    client.release();
  }
});

app.patch("/api/prompts/:id/favorite", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE prompts SET is_favorite = NOT is_favorite, updated_at = now()
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

app.post("/api/prompts/:id/use", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE prompts SET usage_count = usage_count + 1, last_used_at = now()
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

app.post("/api/prompts/:id/duplicate", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `INSERT INTO prompts (name, purpose, body, category, tags, model_guidance, expected_output)
       SELECT name || ' (copy)', purpose, body, category, tags, model_guidance, expected_output
       FROM prompts WHERE id = $1 RETURNING ${COLUMNS}`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

app.delete("/api/prompts/:id", async (req, res, next) => {
  try {
    const r = await pool.query("DELETE FROM prompts WHERE id = $1", [
      req.params.id,
    ]);
    res.status(r.rowCount ? 204 : 404).end();
  } catch (e) {
    next(e);
  }
});

// VERSIONS
app.get("/api/prompts/:id/versions", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM prompt_versions WHERE prompt_id = $1 ORDER BY created_at DESC",
      [req.params.id],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

app.post("/api/prompts/:id/restore/:versionId", async (req, res, next) => {
  try {
    const v = await pool.query(
      "SELECT * FROM prompt_versions WHERE id = $1 AND prompt_id = $2",
      [req.params.versionId, req.params.id],
    );
    if (!v.rows[0]) return res.status(404).json({ error: "version not found" });
    const cur = await pool.query(
      "SELECT name, purpose, body FROM prompts WHERE id = $1",
      [req.params.id],
    );
    await pool.query(
      "INSERT INTO prompt_versions (prompt_id, name, purpose, body) VALUES ($1,$2,$3,$4)",
      [req.params.id, cur.rows[0].name, cur.rows[0].purpose, cur.rows[0].body],
    );
    const { rows } = await pool.query(
      `UPDATE prompts SET name=$1, purpose=$2, body=$3, updated_at=now()
       WHERE id=$4 RETURNING ${COLUMNS}`,
      [v.rows[0].name, v.rows[0].purpose, v.rows[0].body, req.params.id],
    );
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// EXPORT / IMPORT
app.get("/api/export", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM prompts ORDER BY created_at`,
    );
    const doc = { exported_at: new Date().toISOString(), prompts: rows };
    const file = `prompts-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    try {
      await fs.mkdir(EXPORT_DIR, { recursive: true });
      await fs.writeFile(
        path.join(EXPORT_DIR, file),
        JSON.stringify(doc, null, 2),
      );
    } catch (err) {
      console.warn("[export] could not write to disk:", err.message);
    }
    res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
    res.json(doc);
  } catch (e) {
    next(e);
  }
});

app.post("/api/import", async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body?.prompts;
    if (!Array.isArray(items))
      return res.status(400).json({ error: "expected { prompts: [] }" });
    let imported = 0;
    for (const p of items) {
      if (!p?.name) continue;
      await pool.query(
        `INSERT INTO prompts (name, purpose, body, category, tags, model_guidance,
          expected_output, is_favorite) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        payload(p),
      );
      imported++;
    }
    res.json({ imported });
  } catch (e) {
    next(e);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
migrate()
  .then(() => app.listen(PORT, () => console.log(`[api] listening on ${PORT}`)))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
