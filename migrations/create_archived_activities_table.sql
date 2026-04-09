-- Create archived_activities table for storing archived activity records
CREATE TABLE IF NOT EXISTS archived_activities (
  id VARCHAR(50) PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  username VARCHAR(100) NOT NULL,
  activity TEXT NOT NULL,
  details TEXT NOT NULL,
  category ENUM('product', 'sale', 'employee', 'system', 'inventory') NOT NULL,
  cabinet VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  original_id VARCHAR(50),
  INDEX idx_timestamp (timestamp),
  INDEX idx_category (category),
  INDEX idx_username (username),
  INDEX idx_cabinet (cabinet),
  INDEX idx_archived_at (archived_at)
);
