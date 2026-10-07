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
  created_at TEXT NOT NULL,
  reminders_enabled INTEGER DEFAULT 1
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
ALTER TABLE users ADD COLUMN is_kassier INTEGER DEFAULT 0;
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  paid_method TEXT,
  marked_by TEXT,
  credit_of TEXT,
  corrected_by TEXT
);
CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE TABLE reminder_log (
  project_id TEXT NOT NULL,
  start_at TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY(project_id, start_at)
);
CREATE TABLE project_photos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_photos_project ON project_photos(project_id);
CREATE TABLE assembly_attendance (
  year INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  present INTEGER DEFAULT 1,
  PRIMARY KEY(year, user_id)
);
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  decided_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE minutes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
