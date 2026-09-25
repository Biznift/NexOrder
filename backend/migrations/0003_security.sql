-- Tenant isolation + team fields for SaaS users
ALTER TABLE orders ADD COLUMN tenant_id TEXT;
ALTER TABLE inventory ADD COLUMN tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory(tenant_id);

ALTER TABLE saas_users ADD COLUMN owner_id TEXT;
ALTER TABLE saas_users ADD COLUMN permissions TEXT;
ALTER TABLE saas_users ADD COLUMN avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_saas_users_owner ON saas_users(owner_id);
