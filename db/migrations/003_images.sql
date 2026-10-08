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
