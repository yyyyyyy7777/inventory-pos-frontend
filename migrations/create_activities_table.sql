-- Create activities table for activity log
CREATE TABLE IF NOT EXISTS activities (
  id VARCHAR(50) PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  username VARCHAR(100) NOT NULL,
  activity TEXT NOT NULL,
  details TEXT NOT NULL,
  category ENUM('product', 'sale', 'employee', 'system', 'inventory') NOT NULL,
  cabinet VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_timestamp (timestamp),
  INDEX idx_category (category),
  INDEX idx_username (username),
  INDEX idx_cabinet (cabinet)
);
