const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'inventory_pos'
};

async function setupDatabase() {
  let connection;
  try {
    // First connect without specifying database to create it if needed
    connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      connectTimeout: 10000,
    });
    
    console.log('Connected to MySQL server');
    
    // Create database if it doesn't exist
    await connection.query('CREATE DATABASE IF NOT EXISTS inventory_pos');
    console.log('✓ Database created/verified');
    
    // Close connection and reconnect to the database
    await connection.end();
    
    connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      connectTimeout: 10000,
    });
    
    console.log('Connected to inventory_pos database');
    
    // Create category table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS category (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Category table created/verified');
    
    // Create product table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS product (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(255) UNIQUE,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        stock INT DEFAULT 0,
        cabinet VARCHAR(50) DEFAULT 'main',
        categoryId INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (categoryId) REFERENCES category(id) ON DELETE SET NULL
      )
    `);
    console.log('✓ Product table created/verified');
    
    // Create stockaddition table for stock tracking
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS stockaddition (
        id INT AUTO_INCREMENT PRIMARY KEY,
        productId INT NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        addedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cabinet VARCHAR(50) DEFAULT 'main',
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (productId) REFERENCES product(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ StockAddition table created/verified');
    
    // Create StockBatch table (for advanced stock tracking)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS StockBatch (
        id INT AUTO_INCREMENT PRIMARY KEY,
        productId INT NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        costPerUnit DECIMAL(10, 2),
        batchDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expiryDate TIMESTAMP NULL,
        cabinet VARCHAR(50) DEFAULT 'main',
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (productId) REFERENCES product(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ StockBatch table created/verified');
    
    // Create employee table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS employee (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'staff',
        status VARCHAR(20) DEFAULT 'active',
        joinDate DATE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Employee table created/verified');
    
    // Create sales table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        amount DECIMAL(10, 2) NOT NULL,
        paymentMethod VARCHAR(50) NOT NULL,
        staffName VARCHAR(255) NOT NULL,
        cabinet VARCHAR(50) DEFAULT 'main',
        soldAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        items JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Sales table created/verified');
    
    // Insert default categories
    const [categories] = await connection.execute('SELECT COUNT(*) as count FROM category');
    if (categories[0].count === 0) {
      await connection.execute(`
        INSERT INTO category (name) VALUES 
        ('Electronics'),
        ('Clothing'),
        ('Food & Beverages'),
        ('Books'),
        ('Others')
      `);
      console.log('✓ Default categories inserted');
    }
    
    console.log('\n✅ Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupDatabase();
