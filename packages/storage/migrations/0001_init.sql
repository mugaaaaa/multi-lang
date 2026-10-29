CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE learning_plans (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  language VARCHAR(8) NOT NULL,
  title VARCHAR(200) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP(3) NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL,
  KEY idx_plans_owner (owner_id)
);

CREATE TABLE source_documents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  plan_id CHAR(36) NOT NULL,
  language VARCHAR(8) NOT NULL,
  title VARCHAR(200) NOT NULL,
  current_revision INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP(3) NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL,
  KEY idx_source_docs_plan (plan_id)
);

CREATE TABLE source_blocks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  document_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  revision INT NOT NULL,
  block_order INT NOT NULL,
  kind VARCHAR(16) NOT NULL,
  content_json JSON NOT NULL,
  plain_text TEXT NOT NULL,
  KEY idx_blocks_doc (document_id, block_order)
);

CREATE TABLE import_drafts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  language VARCHAR(8) NOT NULL,
  title VARCHAR(200) NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  draft_json JSON NOT NULL,
  published TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL,
  KEY idx_drafts_owner (owner_id)
);

CREATE TABLE note_types (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  language VARCHAR(8) NOT NULL,
  version INT NOT NULL,
  definition_json JSON NOT NULL,
  KEY idx_note_types_lang (language)
);

CREATE TABLE notes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  plan_id CHAR(36) NOT NULL,
  note_type_id VARCHAR(64) NOT NULL,
  note_type_version INT NOT NULL,
  fields_json JSON NOT NULL,
  source_document_id CHAR(36) NULL,
  source_block_id CHAR(36) NULL,
  created_at TIMESTAMP(3) NOT NULL,
  KEY idx_notes_plan (plan_id),
  KEY idx_notes_note_type (note_type_id)
);

CREATE TABLE cards (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  note_id CHAR(36) NOT NULL,
  plan_id CHAR(36) NOT NULL,
  template_id VARCHAR(64) NOT NULL,
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL,
  KEY idx_cards_plan (plan_id),
  KEY idx_cards_note (note_id)
);

CREATE TABLE card_scheduling_states (
  card_id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'new',
  due_at TIMESTAMP(3) NOT NULL,
  stability DOUBLE NOT NULL DEFAULT 0,
  difficulty DOUBLE NOT NULL DEFAULT 0,
  scheduler_version VARCHAR(32) NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL
);

CREATE TABLE review_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  card_id CHAR(36) NOT NULL,
  rating VARCHAR(8) NOT NULL,
  reviewed_at TIMESTAMP(3) NOT NULL,
  duration_ms INT NULL,
  prev_state VARCHAR(16) NOT NULL,
  next_state VARCHAR(16) NOT NULL,
  prev_due_at TIMESTAMP(3) NULL,
  next_due_at TIMESTAMP(3) NOT NULL,
  stability DOUBLE NOT NULL,
  difficulty DOUBLE NOT NULL,
  scheduler_version VARCHAR(32) NOT NULL,
  KEY idx_review_logs_card (card_id, reviewed_at)
);

CREATE TABLE search_documents (
  id VARCHAR(128) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  plan_id CHAR(36) NOT NULL,
  language VARCHAR(8) NOT NULL,
  kind VARCHAR(16) NOT NULL,
  source_id CHAR(36) NOT NULL,
  source_revision INT NOT NULL,
  title VARCHAR(200) NULL,
  original_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  reading_text TEXT NULL,
  translation_text TEXT NULL,
  embedding_status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP(3) NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL,
  FULLTEXT KEY ft_search_original (original_text) WITH PARSER space PARSER_PROPERTIES=(min_token_size=1,max_token_size=84),
  FULLTEXT KEY ft_search_normalized (normalized_text) WITH PARSER ngram PARSER_PROPERTIES=(ngram_token_size=1),
  KEY idx_search_owner_plan (owner_id, plan_id),
  KEY idx_search_source (source_id)
);
