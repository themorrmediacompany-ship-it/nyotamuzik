-- MorrMoto migration 004: daily discovery staging + run log.
create table if not exists discovered_candidates (
  id              bigserial primary key,
  url             text not null,
  start_date      date not null,
  source_kind     text not null,          -- 'web-search' | 'adapter:jsonld' | 'adapter:ics' | ...
  host            text not null,
  payload         jsonb not null,         -- extracted fields + image_url + image_source_url + genres (never guessed)
  discovered_at   timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  unique (url, start_date)
);
create index if not exists discovered_candidates_date_idx on discovered_candidates (start_date);

create table if not exists discovery_runs (
  id bigserial primary key, ran_at timestamptz not null, ms int, found int, stored int, searched int, queries int, adapters_ok int, errors int
);

alter table discovered_candidates enable row level security;   -- service role only; the public reads through /api/events
alter table discovery_runs enable row level security;
