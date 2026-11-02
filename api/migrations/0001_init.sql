-- Schema for the shared bill splitter.
-- Money is stored as whole cents (INTEGER). Every constraint is NAMED so it can be explained.

CREATE TABLE homes (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  -- Stops: homes with an empty or whitespace-only name.
  CONSTRAINT homes_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE TABLE members (
  -- seq is the insertion order. "Order members were added" = ORDER BY seq.
  seq     INTEGER PRIMARY KEY AUTOINCREMENT,
  id      TEXT NOT NULL,
  home_id TEXT NOT NULL,
  name    TEXT NOT NULL,
  -- Stops: two members with the same public id.
  CONSTRAINT members_id_unique UNIQUE (id),
  -- Stops: a member that belongs to a home that does not exist.
  CONSTRAINT members_home_fk FOREIGN KEY (home_id) REFERENCES homes (id),
  -- Stops: members with an empty name.
  CONSTRAINT members_name_not_blank CHECK (length(trim(name)) > 0)
);
CREATE INDEX members_home_idx ON members (home_id, seq);

CREATE TABLE bills (
  id          TEXT PRIMARY KEY,
  home_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  -- Stops: a bill for a home that does not exist.
  CONSTRAINT bills_home_fk FOREIGN KEY (home_id) REFERENCES homes (id),
  -- Stops: blank titles.
  CONSTRAINT bills_title_not_blank CHECK (length(trim(title)) > 0),
  -- Stops: zero, negative, decimal (REAL) or text totals, even if the API check is bypassed.
  CONSTRAINT bills_total_positive_integer CHECK (typeof(total_cents) = 'integer' AND total_cents > 0)
);
CREATE INDEX bills_home_idx ON bills (home_id);

CREATE TABLE shares (
  id              TEXT PRIMARY KEY,
  bill_id         TEXT NOT NULL,
  member_id       TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,
  paid_at         TEXT,
  idempotency_key TEXT,
  -- Stops: a share for a bill that does not exist.
  CONSTRAINT shares_bill_fk FOREIGN KEY (bill_id) REFERENCES bills (id),
  -- Stops: a share for a member that does not exist.
  CONSTRAINT shares_member_fk FOREIGN KEY (member_id) REFERENCES members (id),
  -- Stops: negative or non-integer share amounts.
  CONSTRAINT shares_amount_valid CHECK (typeof(amount_cents) = 'integer' AND amount_cents >= 0),
  -- Stops: two shares of the same bill for the same member (double charging).
  CONSTRAINT shares_one_per_member_per_bill UNIQUE (bill_id, member_id),
  -- Stops: a "paid" share without the key that paid it, or a key on an unpaid share.
  CONSTRAINT shares_paid_state_consistent CHECK ((paid_at IS NULL) = (idempotency_key IS NULL))
);
CREATE INDEX shares_bill_idx ON shares (bill_id);
CREATE INDEX shares_member_idx ON shares (member_id);
