-- Add lastRestockDate column to product table (PostgreSQL syntax)
ALTER TABLE product ADD COLUMN IF NOT EXISTS "lastRestockDate" TIMESTAMP;

-- Create index for better performance on lastRestockDate queries
CREATE INDEX IF NOT EXISTS idx_product_last_restock_date ON product("lastRestockDate");

-- Update existing products to have a default lastRestockDate based on their updatedAt
UPDATE product SET "lastRestockDate" = "updatedAt" WHERE "lastRestockDate" IS NULL;
