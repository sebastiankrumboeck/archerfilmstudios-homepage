CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  function TEXT DEFAULT '',
  avatar_r2_key TEXT,
  is_admin INTEGER DEFAULT 0,
  is_vorstand INTEGER DEFAULT 0,
  vorstand_title TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  intensity INTEGER CHECK(intensity BETWEEN 1 AND 5),
  location TEXT DEFAULT '',
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  max_members INTEGER,
  created_by TEXT NOT NULL,
  head_user_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE memberships (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY(project_id, user_id)
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_memberships_project ON memberships(project_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE TABLE vorstand_links (
  slot TEXT PRIMARY KEY,
  user_id TEXT NOT NULL
);
CREATE TABLE films (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  poster_r2_key TEXT,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL
);
