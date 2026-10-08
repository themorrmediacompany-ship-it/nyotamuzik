-- MorrMoto migration 006: discovery run log columns the job writes (missing columns made every log insert fail).
alter table discovery_runs add column if not exists purged int;
alter table discovery_runs add column if not exists store_error text;
alter table discovery_runs add column if not exists search_on boolean;
