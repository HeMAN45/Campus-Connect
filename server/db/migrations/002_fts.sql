CREATE VIRTUAL TABLE posts_fts USING fts5(
  title, body, subject_tag,
  content = 'posts', content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, title, body, subject_tag)
  VALUES (new.id, new.title, new.body, coalesce(new.subject_tag, ''));
END;

CREATE TRIGGER posts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, body, subject_tag)
  VALUES ('delete', old.id, old.title, old.body, coalesce(old.subject_tag, ''));
END;

CREATE TRIGGER posts_au AFTER UPDATE OF title, body, subject_tag ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, body, subject_tag)
  VALUES ('delete', old.id, old.title, old.body, coalesce(old.subject_tag, ''));
  INSERT INTO posts_fts(rowid, title, body, subject_tag)
  VALUES (new.id, new.title, new.body, coalesce(new.subject_tag, ''));
END;

CREATE VIRTUAL TABLE users_fts USING fts5(
  name, department, designation, office_location, subjects, skills,
  tokenize = 'unicode61 remove_diacritics 2'
);
