
-- sqlite3 belay.sqlite3 < 20230515T013212-create_tables.sql

create table users (
  id INTEGER PRIMARY KEY,
  name VARCHAR(40) UNIQUE,
  password VARCHAR(40),
  api_key VARCHAR(40)
);

create table channels (
  id INTEGER PRIMARY KEY,
  name VARCHAR(40) UNIQUE NOT NULL
);

create table messages (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  channel_id INTEGER,
  body TEXT,
  replies INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(channel_id) REFERENCES channels(id)
);

create table reactions (
  id INTEGER PRIMARY KEY,
  reaction TEXT,
  message_id INTEGER,
  user_id INTEGER,
  UNIQUE(reaction, message_id, user_id),
  FOREIGN KEY(message_id) REFERENCES messages(id),
  FOREIGN KEY(user_id) REFERENCES messages(id)
);

create table read (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  channel_id INTEGER,
  message_id INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(channel_id) REFERENCES channels(id),
  FOREIGN KEY(message_id) REFERENCES messages(id)
);
