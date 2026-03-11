-- Add indexes for better archiving performance
-- These indexes will significantly speed up archive/unarchive operations

-- Index on date and cabinet for faster date-range queries per cabinet
CREATE INDEX IF NOT EXISTS idx_sale_date_cabinet ON sale(date, cabinet);

-- Index on archived status for faster filtering
CREATE INDEX IF NOT EXISTS idx_sale_archived ON sale(archived);

-- Composite index for the most common query pattern (date range + cabinet + archived status)
CREATE INDEX IF NOT EXISTS idx_sale_date_cabinet_archived ON sale(date, cabinet, archived);

-- Index for archive status queries
CREATE INDEX IF NOT EXISTS idx_sale_cabinet_date ON sale(cabinet, date);
