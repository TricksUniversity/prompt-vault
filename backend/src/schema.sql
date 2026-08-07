CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  purpose text DEFAULT '',
  body text NOT NULL DEFAULT '',
  category text DEFAULT 'Uncategorized',
  tags text[] NOT NULL DEFAULT '{}',
  model_guidance text DEFAULT '',
  expected_output text DEFAULT '',
  is_favorite boolean NOT NULL DEFAULT false,
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(purpose, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'C')
  ) STORED
);

CREATE INDEX IF NOT EXISTS prompts_search_idx ON prompts USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS prompts_tags_idx ON prompts USING GIN (tags);
CREATE INDEX IF NOT EXISTS prompts_category_idx ON prompts (category);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  name text NOT NULL,
  purpose text DEFAULT '',
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prompt_versions_prompt_idx ON prompt_versions (prompt_id, created_at DESC);
