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
