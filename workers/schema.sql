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
ALTER TABLE users ADD COLUMN banned_until TEXT;
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
CREATE TABLE assemblies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  held_on TEXT NOT NULL,
  minutes_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE assembly_attendance (
  assembly_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  present INTEGER DEFAULT 1,
  PRIMARY KEY(assembly_id, user_id)
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
CREATE TABLE absence_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decision_note TEXT DEFAULT '',
  decided_by TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX idx_absence_project ON absence_requests(project_id);
CREATE INDEX idx_absence_user ON absence_requests(user_id);
CREATE TABLE call_sheets (
  project_id TEXT PRIMARY KEY,
  call_time TEXT,
  meeting_point TEXT DEFAULT '',
  schedule TEXT DEFAULT '',
  logistics TEXT DEFAULT '',
  emergency_contacts TEXT DEFAULT '',
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE call_sheet_roles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  role TEXT NOT NULL,
  user_id TEXT,
  UNIQUE(project_id, role)
);
CREATE INDEX idx_callsheet_roles_project ON call_sheet_roles(project_id);
CREATE TABLE role_applications (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  role TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE UNIQUE INDEX idx_role_applications_unique ON role_applications(project_id, role, user_id);
CREATE INDEX idx_role_applications_project ON role_applications(project_id);
CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author_name TEXT NOT NULL,
  script_r2_key TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_ideas_creator ON ideas(created_by);
