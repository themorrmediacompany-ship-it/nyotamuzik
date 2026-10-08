-- MorrMoto: full database setup. Paste this whole file into Supabase → SQL Editor → Run.

-- ===== schema.sql =====
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

-- ===== migrations/002_product_phase1.sql =====
-- MorrMoto migration 002 — Product Phase 01.
-- Adds multi-city support, users + favorites, source health, consumer trust fields, featured / worth-the-drive, search.
-- Run after schema.sql. Idempotent where Postgres allows.

create table if not exists cities (
  id         text primary key,                 -- 'aus', later 'dfw','la','nyc','mia'
  name       text not null,                    -- 'Austin'
  code       text not null,                    -- editorial shorthand shown as MORRMOTO / AUS (not an official code)
  center     geography(point, 4326) not null,
  default_radius_mi int not null default 25,
  active     boolean not null default false
);
insert into cities (id, name, code, center, active) values ('aus', 'Austin', 'AUS', 'SRID=4326;POINT(-97.7431 30.2672)', true) on conflict do nothing;
alter table regions add column if not exists city_id text references cities(id) default 'aus';

-- Source health ------------------------------------------------------------
do $$ begin create type source_health as enum ('healthy','failing','restricted','changed','stale','never_checked'); exception when duplicate_object then null; end $$;
do $$ begin create type automation_status as enum ('ready','needs_config','awaiting_permission','restricted','manual'); exception when duplicate_object then null; end $$;
alter table sources
  add column if not exists city_id text references cities(id) default 'aus',
  add column if not exists feed_url text,
  add column if not exists automation automation_status not null default 'manual',
  add column if not exists health source_health not null default 'never_checked',
  add column if not exists last_success_at timestamptz,
  add column if not exists last_event_found_at timestamptz,
  add column if not exists failure_count int not null default 0,
  add column if not exists last_content_hash text;

create or replace function refresh_source_health(p_source uuid) returns void language plpgsql as $$
declare last record; begin
  select * into last from source_checks where source_id = p_source order by started_at desc limit 1;
  update sources s set
    health = case
      when s.automation = 'restricted' then 'restricted'
      when last is null then 'never_checked'
      when last.error is not null then 'failing'
      when s.last_content_hash is not null and last.content_hash is not null and last.content_hash <> s.last_content_hash and last.items_found = 0 then 'changed'
      when s.last_success_at < now() - (s.crawl_frequency * 3) then 'stale'
      else 'healthy' end,
    failure_count = case when last.error is not null then s.failure_count + 1 else 0 end,
    last_success_at = case when last.error is null and last is not null then coalesce(last.finished_at, last.started_at) else s.last_success_at end,
    last_event_found_at = case when last.items_new > 0 then coalesce(last.finished_at, last.started_at) else s.last_event_found_at end,
    last_content_hash = coalesce(last.content_hash, s.last_content_hash),
    last_checked_at = coalesce(last.started_at, s.last_checked_at)
  where s.id = p_source;
end $$;

-- Canonical event additions --------------------------------------------------
alter table events
  add column if not exists city_id text references cities(id) default 'aus',
  add column if not exists ticket_url text,
  add column if not exists featured boolean not null default false,
  add column if not exists worth_the_drive boolean not null default false,  -- MVP: reviewer flag. Later: model-driven.
  add column if not exists primary_source_id uuid references sources(id),
  add column if not exists community_submitted boolean not null default false,
  add column if not exists search tsvector;
create index if not exists events_search_idx on events using gin (search);
create index if not exists events_city_date_idx on events (city_id, start_date) where state in ('verified','likely');

create or replace function events_search_refresh() returns trigger language plpgsql as $$ begin
  new.search := setweight(to_tsvector('simple', coalesce(new.title,'')), 'A') || setweight(to_tsvector('simple', coalesce(new.description,'')), 'C');
  return new; end $$;
drop trigger if exists events_search_trg on events;
create trigger events_search_trg before insert or update of title, description on events for each row execute function events_search_refresh();

-- Consumer trust language (never exposes scores)
create or replace view public_events as
select e.*,
  case
    when e.lifecycle = 'canceled'  then 'CANCELED'
    when e.lifecycle = 'postponed' then 'POSTPONED'
    when e.lifecycle = 'sold_out'  then 'SOLD OUT'
    when e.lifecycle = 'updated'   then 'UPDATED'
    when e.community_submitted and e.state = 'likely' then 'COMMUNITY'
    when e.state = 'verified' and e.last_verified_at > now() - interval '3 days' then 'RECENTLY CONFIRMED'
    when e.state = 'verified' then 'VERIFIED'
    else null end as trust_label,
  (e.discovered_at > now() - interval '3 days') as is_new
from events e
where e.state in ('verified','likely') and coalesce(e.end_date, e.start_date) >= current_date;

-- Users + favorites (auth later; anonymous device ids work now) ---------------------
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),   -- = auth.users.id once Supabase Auth is on
  device_id   text unique,                                  -- anonymous saving before sign-in
  home_city   text references cities(id) default 'aus',
  home_point  geography(point, 4326),                       -- rounded to ~1 mi; never exact
  radius_mi   int not null default 25,
  prefs       jsonb not null default '{"vehicle":[],"event":[]}',
  created_at  timestamptz not null default now()
);
create table if not exists favorites (
  user_id   uuid references users(id) on delete cascade,
  event_id  uuid references events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- Submissions: link-first flow ------------------------------------------------
alter table submissions
  add column if not exists status text not null default 'in_review' check (status in ('in_review','accepted','rejected','duplicate')),
  add column if not exists read_via text,                      -- 'known' | 'json-ld' | 'opengraph' | 'manual'
  add column if not exists extracted jsonb,                    -- what the reader found, untouched
  add column if not exists corrected jsonb,                    -- what the submitter changed
  add column if not exists user_id uuid references users(id);

-- RLS: public reads published events only; writes go through service role.
alter table events enable row level security;
drop policy if exists events_public_read on events;
create policy events_public_read on events for select using (state in ('verified','likely'));
alter table favorites enable row level security;
drop policy if exists favorites_owner on favorites;
create policy favorites_owner on favorites using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===== migrations/003_images.sql =====
-- MorrMoto migration 003: image library with provenance, focal points, derivatives.
do $$ begin create type image_usage as enum ('event-source','venue','licensed-editorial','morrmoto-editorial','direction-only'); exception when duplicate_object then null; end $$;

create table if not exists images (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null,                 -- object-storage key of the archival original
  image_url     text,                          -- original remote URL, if any
  source_url    text,                          -- page where the image and its terms were found
  source_name   text,
  photographer  text,
  usage         image_usage not null,
  license       text not null,                 -- licence / permission notes, e.g. 'CC BY-SA 4.0' or 'Organizer permission 2026-10-04 (email)'
  alt_text      text not null,
  width int, height int, focal_x numeric(4,3) default .5, focal_y numeric(4,3) default .5,
  blurhash      text,
  categories    text[] not null default '{}',
  places        text[] not null default '{}',
  times         text[] not null default '{}',
  has_people    boolean,
  event_id      uuid references events(id) on delete set null,
  organizer_id  uuid references organizers(id),
  venue_id      uuid references venues(id),
  city_id       text references cities(id) default 'aus',
  date_added    timestamptz not null default now(),
  last_checked  timestamptz,
  active        boolean not null default true,
  check (usage <> 'direction-only' or event_id is null)   -- reference art can never be attached to a real event
);
create index if not exists images_tags_idx on images using gin (categories, places, times);
create index if not exists images_event_idx on images (event_id) where active;

create table if not exists image_derivatives (
  image_id uuid references images(id) on delete cascade,
  width int not null, format text not null check (format in ('avif','webp','jpeg')),
  storage_path text not null, bytes int,
  primary key (image_id, width, format)
);

alter table events add column if not exists primary_image_id uuid references images(id);

-- ===== migrations/004_discovery.sql =====
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


-- Corrections, organizer requests, contact and takedown messages. Reviewed by a person in /admin.
create table if not exists event_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('correction','organizer','contact')),
  reason text not null,
  event_id text, event_title text, note text, email text, page text, ip_hash text,
  status text not null default 'open' check (status in ('open','resolved','rejected')),
  resolved_at timestamptz
);
create index if not exists event_reports_open on event_reports (status, created_at desc);
alter table event_reports enable row level security; -- service key only; no public policies

-- ===== migrations/006_discovery_runs.sql =====
-- MorrMoto migration 006: discovery run log columns the job writes (missing columns made every log insert fail).
alter table discovery_runs add column if not exists purged int;
alter table discovery_runs add column if not exists store_error text;
alter table discovery_runs add column if not exists search_on boolean;
