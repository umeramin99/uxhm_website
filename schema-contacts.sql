-- Contact form submissions
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  service TEXT,
  message TEXT,
  source TEXT,
  page TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
