CREATE TABLE departments (
  id          SERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE CHECK (length(code) BETWEEN 2 AND 12),
  name        TEXT NOT NULL CHECK (length(name) <= 100),
  school      TEXT CHECK (length(school) <= 120),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id               SERIAL PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  name             TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  role             TEXT NOT NULL CHECK (role IN ('student','teacher','admin')),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','suspended')),
  prior_status     TEXT CHECK (prior_status IN ('active','pending')),
  suspended_until  TIMESTAMPTZ,
  avatar_url       TEXT,
  bio              TEXT CHECK (length(bio) <= 300),
  department_id    INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  program          TEXT CHECK (length(program) <= 40),
  year             INTEGER CHECK (year BETWEEN 1 AND 5),
  section          TEXT CHECK (length(section) <= 10),
  graduation_year  INTEGER CHECK (graduation_year BETWEEN 2000 AND 2100),
  enrollment_no    TEXT CHECK (length(enrollment_no) <= 20),
  designation      TEXT CHECK (length(designation) <= 60),
  office_location  TEXT CHECK (length(office_location) <= 100),
  office_hours     TEXT CHECK (length(office_hours) <= 120),
  subjects         TEXT NOT NULL DEFAULT '[]',
  skills           TEXT NOT NULL DEFAULT '[]',
  github_url       TEXT CHECK (length(github_url) <= 200),
  linkedin_url     TEXT CHECK (length(linkedin_url) <= 200),
  open_to_mentor   SMALLINT NOT NULL DEFAULT 0 CHECK (open_to_mentor IN (0,1)),
  mentor_topics    TEXT NOT NULL DEFAULT '[]',
  search_vector    TSVECTOR,
  last_seen_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_users_mentor ON users(open_to_mentor, year) WHERE open_to_mentor = 1;
CREATE INDEX idx_users_fts ON users USING GIN(search_vector);

CREATE TABLE email_otps (
  id           SERIAL PRIMARY KEY,
  email        TEXT NOT NULL,
  purpose      TEXT NOT NULL CHECK (purpose IN ('register','reset_password')),
  code_hash    TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  request_ip   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_otps_email_created ON email_otps(email, purpose, created_at);

CREATE TABLE communities (
  id              SERIAL PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 2 AND 40 AND slug ~ '^[a-z0-9-]+$'),
  name            TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 60),
  description     TEXT CHECK (length(description) <= 500),
  rules           TEXT CHECK (length(rules) <= 2000),
  type            TEXT NOT NULL CHECK (type IN ('official','department','batch','club','interest')),
  department_id   INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  graduation_year INTEGER,
  avatar_url      TEXT,
  cover_url       TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','rejected','archived')),
  is_verified     SMALLINT NOT NULL DEFAULT 0 CHECK (is_verified IN (0,1)),
  auto_join       SMALLINT NOT NULL DEFAULT 0 CHECK (auto_join IN (0,1)),
  member_count    INTEGER NOT NULL DEFAULT 0,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (type <> 'batch' OR (department_id IS NOT NULL AND graduation_year IS NOT NULL))
);
CREATE INDEX idx_communities_type_status ON communities(type, status);
CREATE UNIQUE INDEX uq_batch ON communities(department_id, graduation_year) WHERE type = 'batch';

CREATE TABLE community_members (
  community_id  INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','moderator','admin')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX idx_members_user ON community_members(user_id);
CREATE INDEX idx_members_role ON community_members(community_id, role) WHERE role <> 'member';

CREATE TABLE posts (
  id                   SERIAL PRIMARY KEY,
  author_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id         INTEGER REFERENCES communities(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL CHECK (type IN ('general','doubt','request','lost','found','announcement','event')),
  title                TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 150),
  body                 TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 5000),
  status               TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_at          TIMESTAMPTZ,
  subject_tag          TEXT CHECK (length(subject_tag) <= 30),
  accepted_comment_id  INTEGER,
  needed_by            TIMESTAMPTZ,
  item_location        TEXT CHECK (length(item_location) <= 100),
  item_date            TEXT,
  event_starts_at      TIMESTAMPTZ,
  event_ends_at        TIMESTAMPTZ,
  event_venue          TEXT CHECK (length(event_venue) <= 120),
  event_url            TEXT CHECK (length(event_url) <= 300),
  going_count          INTEGER NOT NULL DEFAULT 0,
  interested_count     INTEGER NOT NULL DEFAULT 0,
  is_pinned            SMALLINT NOT NULL DEFAULT 0 CHECK (is_pinned IN (0,1)),
  pinned_until         TIMESTAMPTZ,
  comments_locked      SMALLINT NOT NULL DEFAULT 0 CHECK (comments_locked IN (0,1)),
  is_hidden            SMALLINT NOT NULL DEFAULT 0 CHECK (is_hidden IN (0,1)),
  score                INTEGER NOT NULL DEFAULT 0,
  comment_count        INTEGER NOT NULL DEFAULT 0,
  search_vector        TSVECTOR,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at            TIMESTAMPTZ,
  deleted_at           TIMESTAMPTZ,
  CHECK (type <> 'doubt' OR subject_tag IS NOT NULL),
  CHECK (type NOT IN ('lost','found') OR (item_location IS NOT NULL AND item_date IS NOT NULL)),
  CHECK (type <> 'event' OR (community_id IS NOT NULL AND event_starts_at IS NOT NULL AND event_venue IS NOT NULL)),
  CHECK (event_ends_at IS NULL OR event_ends_at > event_starts_at),
  CHECK (status = 'open' OR type IN ('doubt','request','lost','found'))
);
CREATE INDEX idx_posts_feed_new  ON posts(created_at DESC, id DESC) WHERE deleted_at IS NULL AND is_hidden = 0;
CREATE INDEX idx_posts_type_new  ON posts(type, created_at DESC) WHERE deleted_at IS NULL AND is_hidden = 0;
CREATE INDEX idx_posts_community ON posts(community_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_author    ON posts(author_id, created_at DESC);
CREATE INDEX idx_posts_events    ON posts(event_starts_at) WHERE type = 'event' AND deleted_at IS NULL;
CREATE INDEX idx_posts_pinned    ON posts(is_pinned, pinned_until) WHERE is_pinned = 1;
CREATE INDEX idx_posts_subject   ON posts(subject_tag) WHERE type = 'doubt';
CREATE INDEX idx_posts_fts       ON posts USING GIN(search_vector);

ALTER TABLE posts ADD CONSTRAINT fk_accepted_comment FOREIGN KEY (accepted_comment_id) REFERENCES comments(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE post_images (
  id          SERIAL PRIMARY KEY,
  post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt_text    TEXT CHECK (length(alt_text) <= 200),
  width       INTEGER,
  height      INTEGER,
  bytes       INTEGER,
  position    INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
  UNIQUE (post_id, position)
);

CREATE TABLE post_votes (
  post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value       INTEGER NOT NULL CHECK (value IN (-1, 1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_post_votes_user ON post_votes(user_id);

CREATE TABLE comments (
  id          SERIAL PRIMARY KEY,
  post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id   INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  depth       INTEGER NOT NULL DEFAULT 0 CHECK (depth IN (0, 1)),
  body        TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 2000),
  image_url   TEXT,
  image_alt   TEXT CHECK (length(image_alt) <= 200),
  score       INTEGER NOT NULL DEFAULT 0,
  is_hidden   SMALLINT NOT NULL DEFAULT 0 CHECK (is_hidden IN (0,1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at   TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ,
  CHECK (length(body) > 0 OR image_url IS NOT NULL),
  CHECK ((parent_id IS NULL AND depth = 0) OR (parent_id IS NOT NULL AND depth = 1))
);
CREATE INDEX idx_comments_post   ON comments(post_id, created_at);
CREATE INDEX idx_comments_author ON comments(author_id, created_at DESC);
CREATE INDEX idx_comments_parent ON comments(parent_id);

CREATE TABLE comment_votes (
  comment_id  INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value       INTEGER NOT NULL CHECK (value IN (-1, 1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE event_rsvps (
  post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('going','interested')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_rsvps_user ON event_rsvps(user_id);

CREATE TABLE conversations (
  id                   SERIAL PRIMARY KEY,
  user_a_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_a_last_read_id  INTEGER NOT NULL DEFAULT 0,
  user_b_last_read_id  INTEGER NOT NULL DEFAULT 0,
  last_message_id      INTEGER,
  last_message_at      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX idx_conv_a ON conversations(user_a_id, last_message_at DESC);
CREATE INDEX idx_conv_b ON conversations(user_b_id, last_message_at DESC);

CREATE TABLE messages (
  id               SERIAL PRIMARY KEY,
  conversation_id  INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body             TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 2000),
  image_url        TEXT,
  client_id        TEXT CHECK (length(client_id) <= 64),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  CHECK (length(body) > 0 OR image_url IS NOT NULL),
  UNIQUE (sender_id, client_id)
);
CREATE INDEX idx_messages_conv ON messages(conversation_id, id DESC);

CREATE TABLE user_blocks (
  blocker_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX idx_blocks_blocked ON user_blocks(blocked_id);

CREATE TABLE notifications (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN (
                  'post_comment','comment_reply','answer_accepted',
                  'announcement','community_announcement','community_event',
                  'teacher_approved','teacher_rejected',
                  'community_approved','community_rejected',
                  'content_removed')),
  actor_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_count   INTEGER NOT NULL DEFAULT 1,
  post_id       INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  comment_id    INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  community_id  INTEGER REFERENCES communities(id) ON DELETE CASCADE,
  data          TEXT NOT NULL DEFAULT '{}',
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications(user_id, updated_at DESC);
CREATE INDEX idx_notif_unread ON notifications(user_id) WHERE read_at IS NULL;

CREATE TABLE reports (
  id            SERIAL PRIMARY KEY,
  reporter_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type   TEXT NOT NULL CHECK (target_type IN ('post','comment','message','user')),
  target_id     INTEGER NOT NULL,
  community_id  INTEGER REFERENCES communities(id) ON DELETE SET NULL,
  reason        TEXT NOT NULL CHECK (reason IN ('spam','harassment','inappropriate','misinformation','other')),
  details       TEXT CHECK (length(details) <= 500),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
  resolved_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolution    TEXT CHECK (resolution IN ('dismiss','remove','suspend')),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX idx_reports_target ON reports(target_type, target_id);
CREATE UNIQUE INDEX uq_reports_open ON reports(reporter_id, target_type, target_id) WHERE status = 'open';

CREATE OR REPLACE FUNCTION posts_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.title, '') || ' ' || coalesce(NEW.body, '') || ' ' || coalesce(NEW.subject_tag, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_fts_update BEFORE INSERT OR UPDATE OF title, body, subject_tag ON posts
FOR EACH ROW EXECUTE FUNCTION posts_search_update();
