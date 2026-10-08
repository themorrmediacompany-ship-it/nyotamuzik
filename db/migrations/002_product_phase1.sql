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
