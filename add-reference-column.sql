-- Add referenceNumber column to Sale table if it doesn't exist
ALTER TABLE Sale ADD COLUMN referenceNumber VARCHAR(255) NULL;
