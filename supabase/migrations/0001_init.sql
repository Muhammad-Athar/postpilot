create extension if not exists vector;
create extension if not exists pgcrypto;

create type workspace_mode as enum ('single','agency');
create type draft_status as enum ('draft','approved','rejected','scheduled','published','failed');
create type campaign_status as enum ('queued','generating','review','done','failed');
create type feedback_action as enum ('approve','edit','reject','regenerate');
create type account_status as enum ('ok','reconnect','error');

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode workspace_mode not null default 'single',
  timezone text not null default 'UTC',
  cadence_rule jsonb not null default '{"type":"weekdays","times":["10:00"]}',
  posting_windows jsonb not null default '{}',
  default_settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  primary key (workspace_id, user_id)
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  kit jsonb not null default '{}',
  voice_profile text not null default '',
  banned_words text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table connected_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  platform text not null,
  adapter text not null check (adapter in ('native','late')),
  external_id text,
  tokens_encrypted text,
  status account_status not null default 'ok',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (brand_id, workspace_id) references brands(id, workspace_id) on delete cascade
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  prompt text not null,
  "references" jsonb not null default '[]',
  settings jsonb not null default '{}',
  status campaign_status not null default 'queued',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (brand_id, workspace_id) references brands(id, workspace_id) on delete cascade
);

create table drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  platform text not null,
  candidate_index int not null default 0,
  version int not null default 1,
  parent_draft_id uuid references drafts(id),
  hook text not null default '',
  caption text not null default '',
  hashtags text[] not null default '{}',
  first_comment text,
  alt_text text,
  media_plan jsonb not null default '{}',
  media_urls text[] not null default '{}',
  change_notes text[] not null default '{}',
  status draft_status not null default 'draft',
  embedding vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (campaign_id, workspace_id) references campaigns(id, workspace_id) on delete cascade,
  foreign key (brand_id, workspace_id) references brands(id, workspace_id) on delete cascade,
  foreign key (parent_draft_id, workspace_id) references drafts(id, workspace_id)
);
create index drafts_campaign_idx on drafts(campaign_id);
create index drafts_brand_status_idx on drafts(brand_id, status);

create table feedback_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  draft_id uuid not null references drafts(id) on delete cascade,
  action feedback_action not null,
  note text,
  edit_diff jsonb,
  snapshot jsonb not null default '{}',
  embedding vector(768),
  created_at timestamptz not null default now(),
  foreign key (brand_id, workspace_id) references brands(id, workspace_id) on delete cascade,
  foreign key (draft_id, workspace_id) references drafts(id, workspace_id) on delete cascade
);
create index feedback_brand_idx on feedback_events(brand_id, created_at desc);

create table preference_summaries (
  brand_id uuid primary key references brands(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  summary text not null default '',
  event_count int not null default 0,
  updated_at timestamptz not null default now(),
  foreign key (brand_id, workspace_id) references brands(id, workspace_id) on delete cascade
);

create table render_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  draft_id uuid not null references drafts(id) on delete cascade,
  spec jsonb not null default '{}',
  status text not null default 'queued',
  output_url text,
  thumbnail_url text,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (draft_id, workspace_id) references drafts(id, workspace_id) on delete cascade
);

create table schedule_slots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  platform text not null,
  scheduled_at timestamptz not null,
  draft_id uuid references drafts(id) on delete set null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  foreign key (brand_id, workspace_id) references brands(id, workspace_id) on delete cascade,
  foreign key (draft_id, workspace_id) references drafts(id, workspace_id) on delete set null
);

create table publish_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  draft_id uuid not null references drafts(id) on delete cascade,
  account_id uuid not null references connected_accounts(id) on delete cascade,
  attempts int not null default 0,
  external_id text,
  permalink text,
  error text,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (draft_id, workspace_id) references drafts(id, workspace_id) on delete cascade,
  foreign key (account_id, workspace_id) references connected_accounts(id, workspace_id) on delete cascade
);

create table metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid not null references connected_accounts(id) on delete cascade,
  draft_id uuid references drafts(id) on delete set null,
  captured_at timestamptz not null default now(),
  metrics jsonb not null default '{}',
  foreign key (account_id, workspace_id) references connected_accounts(id, workspace_id) on delete cascade,
  foreign key (draft_id, workspace_id) references drafts(id, workspace_id) on delete set null
);

create table approval_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  draft_id uuid not null references drafts(id) on delete cascade,
  draft_version int not null,
  channel text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (draft_id, workspace_id) references drafts(id, workspace_id) on delete cascade
);

create table quota_usage (
  provider text not null,
  day date not null,
  units_used int not null default 0,
  units_limit int not null,
  primary key (provider, day)
);
alter table quota_usage enable row level security; -- no policies: service role only

-- draft state machine
create or replace function enforce_draft_transition() returns trigger language plpgsql as $$
begin
  if old.status = new.status then return new; end if;
  if (old.status = 'draft' and new.status in ('approved','rejected'))
     or (old.status = 'approved' and new.status = 'scheduled')
     or (old.status = 'scheduled' and new.status in ('published','failed'))
     or (old.status = 'failed' and new.status = 'scheduled') then
    return new;
  end if;
  raise exception 'invalid draft transition % -> %', old.status, new.status;
end $$;
create trigger drafts_transition before update of status on drafts
  for each row execute function enforce_draft_transition();

-- updated_at maintenance
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['workspaces','brands','connected_accounts','campaigns','drafts','render_jobs','publish_jobs'] loop
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop; end $$;

-- RLS: members of a workspace can read/write its rows
create or replace function is_member(ws uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members where workspace_id = ws and user_id = auth.uid());
$$;
create or replace function is_owner(ws uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members where workspace_id = ws and user_id = auth.uid() and role = 'owner');
$$;
do $$ declare t text; begin
  foreach t in array array['workspaces','brands','connected_accounts','campaigns','drafts','feedback_events','preference_summaries','render_jobs','schedule_slots','publish_jobs','metric_snapshots','approval_tokens'] loop
    execute format('alter table %I enable row level security', t);
    if t = 'workspaces' then
      execute 'create policy ws_member_read on workspaces for select using (is_member(id))';
      execute 'create policy ws_owner_write on workspaces for update using (is_owner(id)) with check (is_owner(id))';
      execute 'create policy ws_owner_delete on workspaces for delete using (is_owner(id))';
    else
      execute format('create policy %I_member on %I for all using (is_member(workspace_id)) with check (is_member(workspace_id))', t, t);
    end if;
  end loop; end $$;
alter table workspace_members enable row level security;
create policy members_self on workspace_members for select using (user_id = auth.uid());

-- storage bucket for uploads and renders (public read)
insert into storage.buckets (id, name, public) values ('media','media', true) on conflict do nothing;
create policy media_read on storage.objects for select using (bucket_id = 'media');
-- object paths are '<workspace_id>/...'; only members of that workspace may write there
create policy media_write on storage.objects for insert
  with check (bucket_id = 'media' and is_member(((storage.foldername(name))[1])::uuid));
create policy media_update on storage.objects for update
  using (bucket_id = 'media' and is_member(((storage.foldername(name))[1])::uuid));
create policy media_delete on storage.objects for delete
  using (bucket_id = 'media' and is_member(((storage.foldername(name))[1])::uuid));

-- realtime on drafts
alter publication supabase_realtime add table drafts;
