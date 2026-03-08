import { query } from './pg-direct';

export async function setupDatabase() {
  try {
    console.log('Setting up database...');
    
    // Create category table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS category (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Category table created/verified');
    
    // Create product table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS product (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(255) UNIQUE,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        stock INT DEFAULT 0,
        cabinet VARCHAR(50) DEFAULT 'main',
        "categoryId" INT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("categoryId") REFERENCES category(id) ON DELETE SET NULL
      )
    `);
    console.log('✓ Product table created/verified');
    
    // Create StockBatch table if it doesn't exist (for advanced stock tracking)
    await query(`
      CREATE TABLE IF NOT EXISTS stockbatch (
        id SERIAL PRIMARY KEY,
        "productId" INT NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        "costPerUnit" DECIMAL(10, 2),
        "batchDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "expiryDate" TIMESTAMP NULL,
        cabinet VARCHAR(50) DEFAULT 'main',
        status VARCHAR(20) DEFAULT 'on-shelf',
        notes TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("productId") REFERENCES product(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ StockBatch table created/verified');
    
    // Create employee table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS employee (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'staff',
        "joinDate" DATE,
        "lastLogin" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Employee table created/verified');
    
    // Add lastLogin column if it doesn't exist (migration for existing tables)
    try {
      await query(`ALTER TABLE employee ADD COLUMN IF NOT EXISTS "lastLogin" TIMESTAMP`);
      console.log('✓ lastLogin column added to employee table (if not exists)');
    } catch (alterError) {
      console.log('✓ lastLogin column already exists');
    }
    
    // Create sales table if it doesn't exist - Note: must be named 'sale' not 'sales'
    await query(`
      CREATE TABLE IF NOT EXISTS sale (
        id VARCHAR(36) PRIMARY KEY,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        amount DECIMAL(10, 2) NOT NULL,
        "paymentMethod" VARCHAR(50) NOT NULL,
        "staffName" VARCHAR(255) NOT NULL,
        cabinet VARCHAR(50) DEFAULT 'main',
        "soldAt" VARCHAR(20) DEFAULT 'physical',
        "referenceNumber" VARCHAR(255),
        archived BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Sale table created/verified');

    // Create saleItem table
    await query(`
      CREATE TABLE IF NOT EXISTS "saleItem" (
        id SERIAL PRIMARY KEY,
        "saleId" VARCHAR(36) NOT NULL,
        "productName" VARCHAR(255) NOT NULL,
        category VARCHAR(255),
        quantity INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        "originalPrice" DECIMAL(10, 2),
        "costPrice" DECIMAL(10, 2),
        "isDiscounted" BOOLEAN DEFAULT false,
        profit DECIMAL(10, 2),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("saleId") REFERENCES sale(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ SaleItem table created/verified');
    
    // Create user table (for order management)
    await query(`
      CREATE TABLE IF NOT EXISTS "user" (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'STAFF',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ User table created/verified');
    
    // Create order table
    await query(`
      CREATE TABLE IF NOT EXISTS "order" (
        id SERIAL PRIMARY KEY,
        "userId" INT NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Order table created/verified');
    
    // Create orderItem table
    await query(`
      CREATE TABLE IF NOT EXISTS "orderItem" (
        id SERIAL PRIMARY KEY,
        "orderId" INT NOT NULL,
        "productId" INT NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("orderId") REFERENCES "order"(id) ON DELETE CASCADE,
        FOREIGN KEY ("productId") REFERENCES product(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ OrderItem table created/verified');
    
    // Insert default category if none exists
    const categories = await query('SELECT COUNT(*) as count FROM category') as any[];
    if (parseInt(categories[0].count) === 0) {
      await query(`
        INSERT INTO category (name) VALUES 
        ('Electronics'),
        ('Clothing'),
        ('Food & Beverages'),
        ('Books'),
        ('Others')
      `);
      console.log('✓ Default categories inserted');
    }
    
    console.log('Database setup completed successfully!');
    return true;
  } catch (error) {
    console.error('Database setup failed:', error);
    throw error;
  }
}
