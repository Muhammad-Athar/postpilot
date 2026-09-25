-- Unschedule (scheduled → approved), publish results on the draft row for the UI, retry bookkeeping.
alter table drafts add column if not exists permalink text;
alter table drafts add column if not exists publish_error text;
alter table drafts add column if not exists published_at timestamptz;
alter table schedule_slots add column if not exists attempts int not null default 0;
alter table publish_jobs alter column account_id drop not null;   -- a failure before any account exists still gets a job row
create index if not exists publish_jobs_draft_idx on publish_jobs(draft_id, created_at desc);
create index if not exists metric_snapshots_account_time_idx on metric_snapshots(account_id, captured_at desc);

create or replace function enforce_draft_transition() returns trigger language plpgsql as $$
begin
  if old.status = new.status then return new; end if;
  if (old.status = 'draft' and new.status in ('approved','rejected'))
     or (old.status = 'approved' and new.status = 'scheduled')
     or (old.status = 'scheduled' and new.status in ('published','failed','approved'))
     or (old.status = 'failed' and new.status = 'scheduled') then
    return new;
  end if;
  raise exception 'invalid draft transition % -> %', old.status, new.status;
end $$;
