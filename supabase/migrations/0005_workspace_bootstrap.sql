-- Bootstrap race fix: a user owns exactly one workspace, and creation is serialised per user.
-- (Concurrent first requests used to create several workspaces; maybeSingle() then failed on the
-- duplicates and every later request created another one.)
-- The unique owner-per-user index lives in a later migration, applied once the duplicate workspaces are removed.

create or replace function ensure_workspace(p_user uuid, p_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_ws uuid; v_brand uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  select m.workspace_id into v_ws from workspace_members m join workspaces w on w.id = m.workspace_id
    where m.user_id = p_user order by w.created_at asc limit 1;
  if v_ws is not null then return v_ws; end if;
  insert into workspaces(name) values (split_part(p_email, '@', 1) || '''s workspace') returning id into v_ws;
  insert into workspace_members(workspace_id, user_id, role) values (v_ws, p_user, 'owner');
  insert into brands(workspace_id, name) values (v_ws, 'My brand') returning id into v_brand;
  insert into preference_summaries(brand_id, workspace_id) values (v_brand, v_ws);
  return v_ws;
end $$;
revoke all on function ensure_workspace(uuid, text) from public, anon, authenticated;
