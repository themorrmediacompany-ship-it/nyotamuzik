-- MorrMoto Phase 1 schema — PostgreSQL 15+ / Supabase, with PostGIS.
-- Evidence (candidates) and truth (events) are kept in separate tables.
create extension if not exists postgis;
create extension if not exists pg_trgm;   -- title trigram similarity for dedupe blocking
create extension if not exists vector;    -- optional: semantic embeddings (pgvector)

create type source_method   as enum ('api','rss','ics','structured_data','public_html','search_discovery','manual','community_submission');
create type candidate_state as enum ('fetched','extracted','classified','matched','merged','rejected','error');
create type event_state     as enum ('verified','likely','needs_review','rejected');
create type lifecycle_state as enum ('active','updated','canceled','postponed','sold_out','expired');

create table regions (
  id          text primary key,             -- 'georgetown','round-rock','worth-the-drive', ...
  name        text not null,
  core        boolean not null default true,
  boundary    geography(multipolygon, 4326)
);

create table sources (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  name             text not null,
  url              text not null,
  source_type      text not null,           -- venue_official, organizer, club, dealer, platform, aggregator, media, reference, social
  publisher        text,                    -- groups same-owner sources (e.g. scca) so they don't count as independent
  is_primary       boolean not null default false,
  corroboration_only boolean not null default false,
  region_id        text references regions(id),
  categories       text[] not null default '{}',
  discovery_method source_method not null,
  adapter          text not null,           -- adapter key, e.g. 'html:motorsportreg-venue', 'jsonld', 'ics'
  adapter_config   jsonb not null default '{}',
  crawl_frequency  interval not null default '1 day',
  reliability      numeric(3,2) not null check (reliability between 0 and 1),
  robots_ok        boolean,                 -- result of last robots.txt check
  tos_reviewed_at  timestamptz,
  active           boolean not null default true,
  last_checked_at  timestamptz,
  notes            text,
  created_at       timestamptz not null default now()
);

create table source_checks (
  id            bigserial primary key,
  source_id     uuid not null references sources(id) on delete cascade,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  http_status   int,
  content_hash  text,                       -- skip extraction when unchanged
  items_found   int not null default 0,
  items_new     int not null default 0,
  error         text
);
create index on source_checks (source_id, started_at desc);

create table venues (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  street_address text, city text, state text default 'TX', postal_code text,
  region_id     text references regions(id),
  geom          geography(point, 4326),
  aliases       text[] not null default '{}'
);
create index on venues using gist (geom);
create index on venues using gin (name gin_trgm_ops);

create table organizers (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  url      text,
  aliases  text[] not null default '{}',
  source_id uuid references sources(id)     -- organizer's own primary source, if any
);

create table categories    (id text primary key, label text not null, parent_id text references categories(id));
create table vehicle_types (id text primary key, label text not null, parent_id text references vehicle_types(id));

create table recurrence_rules (
  id        uuid primary key default gen_random_uuid(),
  rrule     text not null,                  -- RFC 5545, e.g. 'FREQ=MONTHLY;BYDAY=3SA'
  stated_by_source boolean not null,        -- false = inferred by engine from instances
  dtstart   date, until date
);

create table event_candidates (
  id               uuid primary key default gen_random_uuid(),
  source_id        uuid not null references sources(id),
  source_check_id  bigint references source_checks(id),
  original_url     text not null,
  raw_title        text,
  raw_content      text,                    -- only when ToS permits storage
  raw_content_hash text,
  discovered_at    timestamptz not null default now(),
  last_checked_at  timestamptz not null default now(),
  page_published_at timestamptz,
  extraction       jsonb not null,          -- full extractor output, field-level provenance + per-field confidence
  extractor_version text not null,
  -- normalized extracted columns (null = unknown, never guessed)
  event_name text, start_date date, end_date date, start_time time, end_time time,
  venue_text text, street_address text, city text, geom geography(point,4326),
  organizer_text text, price_text text, is_free boolean, family_friendly boolean,
  registration_required boolean, registration_url text, image_url text,
  motorized boolean,
  recurrence_id    uuid references recurrence_rules(id),
  flags            text[] not null default '{}',
  confidence       numeric(3,2),
  processing_state candidate_state not null default 'fetched',
  event_id         uuid,                     -- set once matched/merged
  unique (source_id, original_url, raw_content_hash)
);
create index on event_candidates (start_date);
create index on event_candidates using gin (event_name gin_trgm_ops);
create index on event_candidates using gist (geom);

create table events (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  start_date date not null, end_date date, start_time time, end_time time,
  venue_id         uuid references venues(id),
  organizer_id     uuid references organizers(id),
  region_id        text references regions(id),
  price_text text, is_free boolean, family_friendly boolean,
  registration_required boolean, registration_url text, image_url text,
  series_id        uuid,                    -- groups occurrences of a recurring meet
  state            event_state not null,
  state_reason     text,
  lifecycle        lifecycle_state not null default 'active',
  confidence       numeric(3,2) not null,
  confidence_breakdown jsonb not null,
  independent_sources int not null default 1,
  field_provenance jsonb not null default '{}',  -- {field: [candidate_id,...]}
  conflicts        jsonb not null default '[]',
  discovered_at    timestamptz not null,
  last_checked_at  timestamptz not null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table event_candidates add foreign key (event_id) references events(id);
create index on events (start_date, state);

create table event_sources (               -- 1 canonical event -> many evidence records
  event_id     uuid references events(id) on delete cascade,
  candidate_id uuid references event_candidates(id),
  match_score  numeric(3,2),
  match_signals jsonb,
  merged_by    text not null,               -- 'auto' | reviewer id
  merged_at    timestamptz not null default now(),
  primary key (event_id, candidate_id)
);

create table event_categories    (event_id uuid references events(id) on delete cascade, category_id text references categories(id), primary key (event_id, category_id));
create table event_vehicle_types (event_id uuid references events(id) on delete cascade, vehicle_type_id text references vehicle_types(id), primary key (event_id, vehicle_type_id));

create table duplicate_suggestions (
  id bigserial primary key,
  event_a uuid references events(id), event_b uuid references events(id),
  score numeric(3,2) not null, signals jsonb not null,
  status text not null default 'open' check (status in ('open','merged','kept_separate')),
  decided_by text, decided_at timestamptz
);

create table review_actions (
  id bigserial primary key,
  event_id uuid references events(id), candidate_id uuid references event_candidates(id),
  action text not null check (action in ('approve','edit','reject','merge','mark_duplicate','mark_canceled','keep_separate')),
  payload jsonb, actor text not null, created_at timestamptz not null default now()
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_url text, submitted_text text, image_path text,
  submitter_contact text,
  candidate_id uuid references event_candidates(id),   -- submissions enter the same candidate pipeline
  created_at timestamptz not null default now()
);

create table engine_config (key text primary key, value jsonb not null, updated_at timestamptz default now());
insert into engine_config values
  ('thresholds', '{"verified":0.80,"likely":0.60,"auto_merge":0.78,"possible_dup":0.50,"min_independent":2}', now());
