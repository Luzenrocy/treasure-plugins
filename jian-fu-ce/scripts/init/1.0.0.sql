CREATE TABLE IF NOT EXISTS vault_sets (
  vault_id TEXT PRIMARY KEY NOT NULL,
  format_version INTEGER NOT NULL,
  salt TEXT NOT NULL,
  kdf_iterations INTEGER NOT NULL,
  verifier_envelope TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('staging', 'ready', 'discarded'))
);

CREATE TABLE IF NOT EXISTS vault_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_vault_id TEXT NOT NULL REFERENCES vault_sets(vault_id),
  previous_vault_id TEXT REFERENCES vault_sets(vault_id),
  revision TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vault_entries (
  vault_id TEXT NOT NULL REFERENCES vault_sets(vault_id),
  entry_id TEXT NOT NULL,
  entry_revision TEXT NOT NULL,
  envelope TEXT NOT NULL,
  PRIMARY KEY (vault_id, entry_id)
);
