import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
INSTANCE_DIR = BASE_DIR / "instance"
DATABASE_PATH = INSTANCE_DIR / "my_series.db"

def get_connection():
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def initialize_database():
    conn = get_connection()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS shows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      summary TEXT,
      image_url TEXT,
      premiered TEXT,
      status TEXT,
      genres TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      season INTEGER,
      number INTEGER,
      name TEXT,
      airdate TEXT,
      runtime_minutes INTEGER,
      watched INTEGER NOT NULL DEFAULT 0,
      watched_at TEXT,
      FOREIGN KEY(show_id) REFERENCES shows(id) ON DELETE CASCADE,
      UNIQUE(show_id, provider_id)
    );
    """)
    columns = [r[1] for r in conn.execute("PRAGMA table_info(shows)").fetchall()]
    if "favorite" not in columns:
        conn.execute("ALTER TABLE shows ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0")
    episode_columns = [r[1] for r in conn.execute("PRAGMA table_info(episodes)").fetchall()]
    if "runtime_minutes" not in episode_columns:
        conn.execute("ALTER TABLE episodes ADD COLUMN runtime_minutes INTEGER")
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS watch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL,
      show_id INTEGER NOT NULL,
      watched_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      runtime_minutes INTEGER,
      FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
      FOREIGN KEY(show_id) REFERENCES shows(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_watch_history_watched_at ON watch_history(watched_at);
    """)
    # Importa para o histórico os episódios que já estavam marcados antes desta versão.
    conn.execute("""INSERT INTO watch_history(episode_id, show_id, watched_at, runtime_minutes)
        SELECT e.id, e.show_id, COALESCE(datetime(e.watched_at,'localtime'), datetime('now','localtime')), e.runtime_minutes
        FROM episodes e WHERE e.watched=1 AND NOT EXISTS
        (SELECT 1 FROM watch_history h WHERE h.episode_id=e.id)""")
    conn.commit()
    conn.close()
