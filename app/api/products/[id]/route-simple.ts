import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

async function getConnection() {
  return await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'inventory_pos'
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.execute(
      `SELECT p.*, c.name as categoryName 
       FROM Product p 
       LEFT JOIN Category c ON p.categoryId = c.id 
       WHERE p.id = ?`,
      [params.id]
    );

    if ((rows as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const product = (rows as any[])[0];
    const transformedProduct = {
      id: product.id.toString(),
      name: product.name,
      sku: `SKU-${product.id}`,
      quantity: product.stock,
      price: product.price,
      category: product.categoryName || 'Others',
      stock: product.stock,
      location: 'physical' as const,
      cabinet: product.cabinet,
      lastUpdated: new Date(product.updatedAt).toLocaleDateString('en-CA'),
    };

    return NextResponse.json(transformedProduct);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let connection;
  try {
    const body = await request.json();
    const { name, price, stock, category, location, cabinet } = body;

    // Validate required fields
    if (!name || price === undefined || stock === undefined || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: name, price, stock, category' },
        { status: 400 }
      );
    }

    // Ensure price is a number
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    const numStock = typeof stock === 'string' ? parseInt(stock) : stock;

    if (isNaN(numPrice) || isNaN(numStock)) {
      return NextResponse.json(
        { error: 'Price and stock must be valid numbers' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    await connection.beginTransaction();

    // Find or create category
    let [categoryRows] = await connection.execute(
      'SELECT * FROM Category WHERE name = ?',
      [category]
    );

    let categoryId: number;
    if ((categoryRows as any[]).length === 0) {
      const [result] = await connection.execute(
        'INSERT INTO Category (name) VALUES (?)',
        [category]
      );
      categoryId = (result as any).insertId;
    } else {
      categoryId = (categoryRows as any[])[0].id;
    }

    // Update product
    await connection.execute(
      `UPDATE Product SET name = ?, price = ?, stock = ?, cabinet = ?, categoryId = ?, updatedAt = NOW() 
       WHERE id = ?`,
      [name, numPrice, numStock, cabinet || 'main', categoryId, params.id]
    );

    await connection.commit();

    // Get updated product
    const [updatedRows] = await connection.execute(
      `SELECT p.*, c.name as categoryName 
       FROM Product p 
       LEFT JOIN Category c ON p.categoryId = c.id 
       WHERE p.id = ?`,
      [params.id]
    );

    if ((updatedRows as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const product = (updatedRows as any[])[0];
    const transformedProduct = {
      id: product.id.toString(),
      name: product.name,
      sku: `SKU-${product.id}`,
      quantity: product.stock,
      price: product.price,
      category: product.categoryName || 'Others',
      stock: product.stock,
      location: location || 'physical',
      cabinet: product.cabinet,
      lastUpdated: new Date(product.updatedAt).toLocaleDateString('en-CA'),
    };

    return NextResponse.json(transformedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    if (connection) {
      await connection.rollback();
    }
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let connection;
  try {
    connection = await getConnection();
    await connection.execute(
      'DELETE FROM Product WHERE id = ?',
      [params.id]
    );

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
