-- Add discount-related columns to SaleItem table
ALTER TABLE SaleItem 
ADD COLUMN originalPrice DECIMAL(10, 2) NULL,
ADD COLUMN costPrice DECIMAL(10, 2) NULL,
ADD COLUMN isDiscounted BOOLEAN DEFAULT FALSE,
ADD COLUMN profit DECIMAL(10, 2) NULL;
