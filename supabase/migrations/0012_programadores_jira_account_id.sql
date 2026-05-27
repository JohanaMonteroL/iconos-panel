-- Vincular cada programador con su accountId de JIRA, para resolver
-- correos de forma exacta cuando el displayName de JIRA no coincide con
-- el nombre interno del programador.

ALTER TABLE programadores
  ADD COLUMN IF NOT EXISTS jira_account_id TEXT;

CREATE INDEX IF NOT EXISTS programadores_jira_account_id_idx
  ON programadores(jira_account_id);
