-- Nearest approved/rejected examples for a brand, by caption embedding. Used to build regeneration context.
create or replace function nearest_feedback(p_brand uuid, p_action feedback_action, p_embedding vector(768), p_limit int)
returns table (snapshot jsonb, distance float) language sql stable security invoker as $$
  select snapshot, embedding <=> p_embedding as distance from feedback_events
  where brand_id = p_brand and action = p_action and embedding is not null
  order by embedding <=> p_embedding limit p_limit;
$$;
