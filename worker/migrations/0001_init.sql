-- =============================================================
-- Bêta Arsenal - Migration initiale (Cloudflare D1 / SQLite)
-- -------------------------------------------------------------
-- Schéma V3 : formulaire unifié (produit + service), section média
-- (démo TikTok OU images GitHub), page de présentation par produit.
-- Plus d'Uploadcare : les fichiers numériques sont hébergés sur un
-- site annexe via le "lien du tunnel de vente" (service_private_link).
-- =============================================================

-- -------------------------------------------------------------
-- Table : admin_users (auth maison)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  last_login_at   TEXT
);

-- -------------------------------------------------------------
-- Table : offers (produits numériques + services, formulaire unifié)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offers (
  id                          TEXT PRIMARY KEY,
  seller_id                   TEXT NOT NULL DEFAULT 'florian',
  type                        TEXT NOT NULL,                -- 'digital_product' | 'service'
  title_fr                    TEXT NOT NULL DEFAULT '',
  title_en                    TEXT NOT NULL DEFAULT '',
  description_fr              TEXT NOT NULL DEFAULT '',
  description_en              TEXT NOT NULL DEFAULT '',

  price                       INTEGER NOT NULL DEFAULT 0,
  currency                    TEXT NOT NULL DEFAULT 'XOF',
  is_active                   INTEGER NOT NULL DEFAULT 1,

  -- Détails de l'offre (communs aux deux types)
  service_mode                TEXT,                          -- 'instructions' | 'rdv' | 'private_link' | 'private_group'
  service_instructions_fr     TEXT,
  service_instructions_en     TEXT,
  service_private_link        TEXT,                          -- Lien du tunnel de vente (site annexe) ou lien privé
  service_booking_link        TEXT,
  service_contact             TEXT,

  -- Section Média (au choix : démo TikTok OU galerie d'images)
  media_type                  TEXT,                          -- 'demo' | 'image' | NULL
  media_demo_url              TEXT,                          -- URL vidéo TikTok si media_type='demo'
  media_images                TEXT NOT NULL DEFAULT '[]',    -- JSON array d'URLs si media_type='image'

  -- Page de présentation (configurable par l'admin, no-code)
  presentation_summary_fr     TEXT,                          -- Résumé long FR
  presentation_summary_en     TEXT,                          -- Résumé long EN
  presentation_highlights_fr  TEXT NOT NULL DEFAULT '[]',    -- JSON array de strings (points forts FR)
  presentation_highlights_en  TEXT NOT NULL DEFAULT '[]',    -- JSON array de strings (points forts EN)
  presentation_excerpts_fr    TEXT NOT NULL DEFAULT '[]',    -- JSON array de {title, content} (extraits FR)
  presentation_excerpts_en    TEXT NOT NULL DEFAULT '[]',    -- JSON array de {title, content} (extraits EN)

  -- Liens sociaux : JSON TEXT
  social_links                TEXT NOT NULL DEFAULT '{}',

  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_offers_active_seller ON offers(is_active, seller_id);

-- -------------------------------------------------------------
-- Table : transactions
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id                          TEXT PRIMARY KEY,
  public_token                TEXT NOT NULL UNIQUE,
  offer_id                    TEXT NOT NULL,
  offer_title                 TEXT NOT NULL DEFAULT '',
  offer_type                  TEXT NOT NULL,
  seller_id                   TEXT NOT NULL DEFAULT 'florian',
  buyer_email                 TEXT NOT NULL,
  amount                      INTEGER NOT NULL,
  currency                    TEXT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'pending',
  fedapay_payment_id          TEXT,
  download_link               TEXT,
  download_link_expires_at    TEXT,
  webhook_received_at         TEXT,
  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_token    ON transactions(public_token);
CREATE INDEX IF NOT EXISTS          idx_tx_fedapay ON transactions(fedapay_payment_id);
CREATE INDEX IF NOT EXISTS          idx_tx_status  ON transactions(status);
CREATE INDEX IF NOT EXISTS          idx_tx_created ON transactions(created_at DESC);
