const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'inventory_pos'
    });

    console.log('Connected to database successfully');

    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123', 12);
    console.log('Password hashed successfully');

    // Insert or update admin user
    const [result] = await connection.execute(`
      INSERT INTO Employee (name, username, password, role, status, joinDate, createdAt, updatedAt) 
      VALUES ('Admin', 'admin', ?, 'admin', 'active', NOW(), NOW(), NOW())
      ON DUPLICATE KEY UPDATE 
      password = ?, 
      role = 'admin', 
      status = 'active',
      updatedAt = NOW()
    `, [hashedPassword, hashedPassword]);

    console.log('Admin user created/updated successfully');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('You can now log in with these credentials');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

createAdmin();
