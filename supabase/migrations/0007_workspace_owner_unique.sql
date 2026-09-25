-- One owned workspace per user. Apply only after duplicate workspaces have been removed
-- (see the 2026-09-26 cleanup: delete every workspace of a user except their earliest).
create unique index if not exists workspace_members_one_owner_per_user on workspace_members(user_id) where role = 'owner';
