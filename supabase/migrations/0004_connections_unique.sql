-- one connection per platform per brand (upsert target for /api/connections)
create unique index if not exists connected_accounts_brand_platform_idx on connected_accounts(brand_id, platform);
