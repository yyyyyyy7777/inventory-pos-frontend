const mysql = require('mysql2/promise');

async function testProductAPI() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'inventory_pos'
    });

    console.log('Testing product fetch...');
    const [rows] = await connection.execute(
      `SELECT p.*, c.name as categoryName 
       FROM Product p 
       LEFT JOIN Category c ON p.categoryId = c.id 
       WHERE p.id = ?`,
      [2]
    );

    console.log('Product data:', rows);

    if (rows.length === 0) {
      console.log('Product not found');
    } else {
      const product = rows[0];
      const transformedProduct = {
        id: product.id.toString(),
        name: product.name,
        sku: `SKU-${product.id}`,
        quantity: product.stock,
        price: product.price,
        category: product.categoryName || 'Others',
        stock: product.stock,
        location: 'physical',
        cabinet: product.cabinet,
        lastUpdated: new Date(product.updatedAt).toLocaleDateString('en-CA'),
      };
      console.log('Transformed product:', transformedProduct);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testProductAPI();
