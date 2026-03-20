import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

let pool: Pool | null = null;

export async function getConnection() {
  if (!pool) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 3, // Limit pool size for serverless environment
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      
      // Test the connection
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('Database connected successfully');
    } catch (error: any) {
      console.error('Database connection failed:', error);
      throw new Error(`Failed to connect to database: ${error.message || 'Unknown connection error'}`);
    }
  }
  return pool;
}

export async function query(sql: string, params?: any[]) {
  try {
    const pool = await getConnection();
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error) {
    console.error('Query execution failed:', { sql, params, error });
    throw error;
  }
}

export async function verifyEmployee(username: string, password: string) {
  const rows = await query(
    'SELECT * FROM employee WHERE username = $1',
    [username]
  );
  
  if (rows.length === 0) return null;
  
  const employee = rows[0];
  const isValidPassword = await bcrypt.compare(password, employee.password);
  
  if (!isValidPassword) return null;
  
  return {
    id: employee.id,
    name: employee.name,
    username: employee.username,
    role: employee.role,
    status: employee.status
  };
}

export async function updateLastLogin(username: string, clientTimestamp?: string) {
  try {
    // Use client timestamp if provided, otherwise use current local time
    let localTime: string;
    
    if (clientTimestamp) {
      // Parse client timestamp and subtract 16 hours
      const date = new Date(clientTimestamp);
      const adjustedTime = new Date(date.getTime() - (16 * 60 * 60 * 1000));
      const month = adjustedTime.getMonth() + 1;
      const day = adjustedTime.getDate();
      const year = adjustedTime.getFullYear();
      let hours = adjustedTime.getHours();
      const minutes = adjustedTime.getMinutes();
      const seconds = adjustedTime.getSeconds();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      localTime = `${month}/${day}/${year} ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
    } else {
      // Fallback: use current local time
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const year = now.getFullYear();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      localTime = `${month}/${day}/${year} ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
    }
    
    console.log('updateLastLogin - Local time:', localTime, 'for user:', username);
    
    await query(
      'UPDATE employee SET "lastLogin" = $1 WHERE username = $2',
      [localTime, username]
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error updating last login:', error);
    return { success: false, error };
  }
}

export async function updateLastLogout(username: string, clientTimestamp?: string) {
  try {
    // Use client timestamp if provided, otherwise use current local time
    let localTime: string;
    
    if (clientTimestamp) {
      // Parse client timestamp and subtract 16 hours
      const date = new Date(clientTimestamp);
      const adjustedTime = new Date(date.getTime() - (16 * 60 * 60 * 1000));
      const month = adjustedTime.getMonth() + 1;
      const day = adjustedTime.getDate();
      const year = adjustedTime.getFullYear();
      let hours = adjustedTime.getHours();
      const minutes = adjustedTime.getMinutes();
      const seconds = adjustedTime.getSeconds();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      localTime = `${month}/${day}/${year} ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
    } else {
      // Fallback: use current local time
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const year = now.getFullYear();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      localTime = `${month}/${day}/${year} ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
    }
    
    console.log('updateLastLogout - Local time:', localTime, 'for user:', username);
    
    await query(
      'UPDATE employee SET "lastLogout" = $1 WHERE username = $2',
      [localTime, username]
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error updating last logout:', error);
    return { success: false, error };
  }
}

export async function getAllEmployees() {
  try {
    const rows = await query(
      'SELECT id, name, username, role, "joinDate", "lastLogin", "lastLogout", "createdAt", "updatedAt" FROM employee ORDER BY "createdAt" DESC'
    );
    
    return rows.map(employee => ({
      ...employee,
      joinDate: new Date(employee.joinDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      lastLogin: employee.lastLogin ? employee.lastLogin : null,
      lastLogout: employee.lastLogout ? employee.lastLogout : null,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt
    }));
  } catch (error) {
    console.error('Error fetching employees, trying without lastLogin/lastLogout:', error);
    // Fallback: query without lastLogin/lastLogout if columns don't exist
    const rows = await query(
      'SELECT id, name, username, role, "joinDate", "createdAt", "updatedAt" FROM employee ORDER BY "createdAt" DESC'
    );
    
    return rows.map(employee => ({
      ...employee,
      joinDate: new Date(employee.joinDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      lastLogin: 'Never',
      lastLogout: 'Never',
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt
    }));
  }
}

export async function getAllProducts(cabinet: string = 'main') {
  // Get products with calculated stock from batches
  const productRows = await query(
    `SELECT p.*, c.name as "categoryName", 
            COALESCE(SUM(sb.quantity), 0) as "calculatedStock"
     FROM product p 
     LEFT JOIN category c ON p."categoryId" = c.id 
     LEFT JOIN stockbatch sb ON p.id = sb."productId" AND sb.cabinet = $1
     WHERE p.cabinet = $2 
     GROUP BY p.id, p.name, p.sku, p.description, p.price, p.stock, p.cabinet, 
              p."categoryId", p."createdAt", p."updatedAt", c.name
     ORDER BY p."createdAt" DESC`,
    [cabinet, cabinet]
  );
  
  // Get last restock dates separately
  const restockRows = await query(
    `SELECT "productId", MAX("batchDate") as "lastRestockDate"
     FROM stockbatch 
     WHERE cabinet = $1
     GROUP BY "productId"`,
    [cabinet]
  );
  
  // Combine the data
  return productRows.map(product => {
    const restockInfo = restockRows.find(r => r.productId === product.id);
    const lastRestockDate = restockInfo?.lastRestockDate ? new Date(restockInfo.lastRestockDate).toLocaleDateString('en-CA') : null;
    
    // Convert calculatedStock to number to avoid string concatenation issues
    const stockValue = parseInt(product.calculatedStock) || 0;
    
    return {
      id: product.id.toString(),
      name: product.name,
      sku: product.sku || `SKU-${product.id}`,
      quantity: stockValue,
      price: product.price,
      category: product.categoryName || 'Others',
      stock: stockValue,
      location: 'physical' as const,
      cabinet: product.cabinet,
      lastUpdated: new Date(product.updatedAt).toLocaleDateString('en-CA'),
      lastRestockDate: lastRestockDate,
      description: product.description,
    };
  });
}

export async function findOrCreateCategory(categoryName: string) {
  const rows = await query(
    'SELECT * FROM category WHERE name = $1',
    [categoryName]
  );
  
  if (rows.length > 0) {
    return {
      id: rows[0].id,
      name: rows[0].name
    };
  }
  
  const result = await query(
    'INSERT INTO category (name) VALUES ($1) RETURNING id, name',
    [categoryName]
  );
  
  return {
    id: result[0].id,
    name: result[0].name
  };
}

// Check if SKU already exists
export async function checkSkuExists(sku: string, cabinet: string, excludeId?: number): Promise<boolean> {
  const rows = await query(
    'SELECT id FROM product WHERE sku = $1 AND cabinet = $2 AND ($3::integer IS NULL OR id != $4::integer)',
    [sku, cabinet, excludeId || null, excludeId || null]
  );
  
  return rows.length > 0;
}

export async function createProduct(data: {
  name: string;
  sku?: string;
  price: number;
  stock: number;
  cabinet: string;
  categoryId: number;
  description?: string;
}) {
  const client = await (await getConnection()).connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Creating product with data:', data); // Debug log
    
    // Validate SKU uniqueness
    if (data.sku) {
      const skuExists = await checkSkuExists(data.sku, data.cabinet);
      if (skuExists) {
        throw new Error(`SKU '${data.sku}' already exists in cabinet '${data.cabinet}'. Please use a different SKU.`);
      }
    }
    
    // Check if product table exists first
    const tableCheck = await client.query('SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = \'product\')');
    if (!tableCheck.rows[0].exists) {
      throw new Error('Product table does not exist');
    }
    
    // Create the product (include stock field for backward compatibility)
    // Use COALESCE to help PostgreSQL infer types for nullable parameters
    const result = await client.query(
      `INSERT INTO product (name, sku, description, price, stock, cabinet, "categoryId", "createdAt", "updatedAt") 
       VALUES ($1, COALESCE($2, NULL::varchar), COALESCE($3, NULL::text), $4, $5, $6, $7, NOW(), NOW()) 
       RETURNING id`,
      [data.name, data.sku, data.description, data.price, data.stock, data.cabinet, data.categoryId]
    );
    
    console.log('INSERT result:', result); // Debug log
    
    const productId = result.rows[0].id;
    
    console.log('Product ID retrieved:', productId); // Debug log
    
    if (!productId) {
      throw new Error('Failed to insert product - no ID returned from database');
    }
    
    await client.query('COMMIT');
    
    const createdProduct = {
      id: productId,
      ...data
    };
    
    console.log('Product created successfully:', createdProduct); // Debug log
    return createdProduct;
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error in createProduct:', error);
    
    // Re-throw the error with proper message
    if (error.message) {
      throw error;
    } else {
      throw new Error('Failed to create product: Unknown error occurred');
    }
  } finally {
    client.release();
  }
}

export async function getAllSales(cabinet: string = 'main') {
  try {
    // First ensure archived column exists (for backward compatibility)
    try {
      await query(`ALTER TABLE sale ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false`);
    } catch (alterError) {
      // Ignore errors if column already exists
    }
    
    const sales = await query(
      `SELECT * FROM sale WHERE cabinet = $1 AND archived = false ORDER BY "createdAt" DESC`,
      [cabinet]
    );
    
    console.log(`getAllSales: Found ${sales.length} active (non-archived) sales for cabinet '${cabinet}'`);
    
    // Get items for each sale
    for (const sale of sales) {
      try {
        const items = await query(
          `SELECT * FROM "saleItem" WHERE "saleId" = $1`,
          [sale.id]
        );
        
        // Convert database boolean values to actual booleans
        sale.items = items.map(item => ({
          ...item,
          isDiscounted: Boolean(item.isDiscounted)
        }));
      } catch (itemError) {
        console.error(`Failed to fetch items for sale ${sale.id}:`, itemError);
        sale.items = [];
      }
    }
    
    return sales;
  } catch (error) {
    console.error('Failed to fetch sales:', error);
    throw new Error('Failed to fetch sales from database');
  }
}

// Helper function to get all sales including archived (for debugging)
export async function getAllSalesWithArchiveStatus(cabinet: string = 'main') {
  try {
    const sales = await query(
      `SELECT id, date, amount, "paymentMethod", "staffName", cabinet, "soldAt", 
              archived, "createdAt", "updatedAt"
       FROM sale 
       WHERE cabinet = $1 
       ORDER BY date DESC`,
      [cabinet]
    );
    
    console.log(`getAllSalesWithArchiveStatus: Found ${sales.length} total sales for cabinet '${cabinet}'`);
    
    return sales;
  } catch (error) {
    console.error('Failed to fetch all sales:', error);
    throw new Error('Failed to fetch sales from database');
  }
}

export async function createSale(data: {
  amount: number;
  paymentMethod: string;
  staffName: string;
  cabinet: string;
  soldAt: string;
  referenceNumber?: string;
  items: Array<{
    productName: string;
    category: string;
    quantity: number;
    price: number;
    originalPrice?: number;
    costPrice?: number;
    isDiscounted?: boolean;
    profit?: number;
  }>;
}) {
  const client = await (await getConnection()).connect();
  
  try {
    await client.query('BEGIN');
    
    // Validate input data
    if (!data.items || data.items.length === 0) {
      throw new Error('Sale must have at least one item');
    }
    
    if (data.amount <= 0) {
      throw new Error('Sale amount must be greater than 0');
    }
    
    // Create the sale
    const saleId = randomUUID();
    await client.query(
      `INSERT INTO sale (id, date, amount, "paymentMethod", "staffName", cabinet, "soldAt", "referenceNumber", "createdAt", "updatedAt") 
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [saleId, data.amount, data.paymentMethod, data.staffName, data.cabinet, data.soldAt, data.referenceNumber || null]
    );
    
    // Create sale items and update product stock with batch tracking
    for (const item of data.items) {
      if (item.quantity <= 0 || item.price < 0) {
        throw new Error('Invalid item quantity or price');
      }
      
      await client.query(
        `INSERT INTO "saleItem" ("saleId", "productName", category, quantity, price, "originalPrice", "costPrice", "isDiscounted", profit) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [saleId, item.productName, item.category, item.quantity, item.price, item.originalPrice || null, item.costPrice || null, item.isDiscounted || false, item.profit || null]
      );
      
      // Get product ID by name
      const productRows = await client.query(
        'SELECT id FROM product WHERE name = $1 AND cabinet = $2',
        [item.productName, data.cabinet]
      );
      
      if (productRows.rows.length === 0) {
        throw new Error(`Product not found: ${item.productName}`);
      }
      
      const productId = productRows.rows[0].id;
      
      // Try batch-aware stock deduction first
      try {
        // Get available on-shelf stock batches using FIFO (only on-shelf, not in-storage)
        const batchRows = await client.query(
          `SELECT id, quantity, "costPerUnit" FROM stockbatch 
           WHERE "productId" = $1 AND cabinet = $2 AND quantity > 0 AND status = 'on-shelf'
           ORDER BY "batchDate" ASC`,
          [productId, data.cabinet]
        );
        
        // If no on-shelf batches found, check if there are in-storage batches
        if (batchRows.rows.length === 0) {
          const storageBatches = await client.query(
            `SELECT COUNT(*) as count FROM stockbatch 
             WHERE "productId" = $1 AND cabinet = $2 AND quantity > 0 AND status = 'in-storage'`,
            [productId, data.cabinet]
          );
          
          if (storageBatches.rows[0].count > 0) {
            throw new Error(`Product "${item.productName}" is in storage. Please transfer to shelf before selling.`);
          }
        }
        
        let remainingQuantity = item.quantity;
        const batchesUsed: Array<{ id: number; quantity: number }> = [];
        
        // FIFO deduction from on-shelf batches only
        for (const batch of batchRows.rows) {
          if (remainingQuantity <= 0) break;
          
          const deductQuantity = Math.min(remainingQuantity, batch.quantity);
          batchesUsed.push({ id: batch.id, quantity: deductQuantity });
          remainingQuantity -= deductQuantity;
        }
        
        if (remainingQuantity > 0) {
          throw new Error(`Insufficient on-shelf stock for product: ${item.productName}. Need ${item.quantity}, only ${item.quantity - remainingQuantity} available on shelf. Please transfer from storage.`);
        }
        
        // Update batches
        for (const usage of batchesUsed) {
          await client.query(
            'UPDATE stockbatch SET quantity = quantity - $1 WHERE id = $2',
            [usage.quantity, usage.id]
          );
        }
        
        // Also update main product stock field (for consistency)
        await client.query(
          'UPDATE product SET stock = stock - $1, "updatedAt" = NOW() WHERE id = $2',
          [item.quantity, productId]
        );
        
      } catch (batchError) {
        console.warn('Batch tracking failed, using simple stock update:', batchError);
        throw batchError; // Re-throw to prevent sale without proper batch tracking
      }
    }
    
    await client.query('COMMIT');
    console.log(`Sale ${saleId} created successfully`);
    
    // Return the created sale with items
    const [createdSale] = await getAllSales(data.cabinet).then(sales => sales.filter(s => s.id === saleId));
    return createdSale;
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating sale:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function getProductById(id: string) {
  const rows = await query(
    `SELECT p.*, c.name as "categoryName", 
            COALESCE(SUM(sb.quantity), 0) as "calculatedStock"
     FROM product p 
     LEFT JOIN category c ON p."categoryId" = c.id 
     LEFT JOIN stockbatch sb ON p.id = sb."productId"
     WHERE p.id = $1
     GROUP BY p.id, p.name, p.sku, p.description, p.price, p.stock, p.cabinet, 
              p."categoryId", p."createdAt", p."updatedAt", c.name`,
    [id]
  );
  
  if (rows.length === 0) return null;
  
  const product = rows[0];
  return {
    id: product.id.toString(),
    name: product.name,
    sku: product.sku || `SKU-${product.id}`, // Use custom SKU or fallback
    quantity: product.calculatedStock || 0,
    price: product.price,
    category: product.categoryName || 'Others',
    stock: product.calculatedStock || 0,
    location: 'physical' as const,
    cabinet: product.cabinet,
    lastUpdated: new Date(product.updatedAt).toLocaleDateString('en-CA'),
    description: product.description,
  };
}

export async function updateProduct(id: string, data: {
  name: string;
  sku?: string;
  price: number;
  stock: number;
  cabinet: string;
  categoryId: number;
  description?: string;
}) {
  const client = await (await getConnection()).connect();
  
  try {
    await client.query('BEGIN');
    
    // Validate SKU uniqueness (exclude current product from check)
    if (data.sku) {
      const skuExists = await checkSkuExists(data.sku, data.cabinet, parseInt(id));
      if (skuExists) {
        throw new Error(`SKU '${data.sku}' already exists in cabinet '${data.cabinet}'. Please use a different SKU.`);
      }
    }
    
    await client.query(
      'UPDATE product SET name = $1, sku = $2, price = $3, stock = $4, "categoryId" = $5, description = $6, "updatedAt" = NOW() WHERE id = $7',
      [data.name, data.sku || null, data.price, data.stock, data.categoryId, data.description || null, parseInt(id)]
    );
    
    await client.query('COMMIT');
    
    return await getProductById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating product:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteSale(saleId: string) {
  const client = await (await getConnection()).connect();
  
  try {
    await client.query('BEGIN');
    
    // Ensure saleId is not undefined
    if (!saleId) {
      throw new Error('Sale ID is required');
    }
    
    // First, get the sale using the existing query function
    const sales = await query(
      `SELECT * FROM sale WHERE id = $1`,
      [saleId]
    );
    
    if (sales.length === 0) {
      throw new Error('Sale not found');
    }
    
    // Get sale items
    const items = await query(
      `SELECT * FROM "saleItem" WHERE "saleId" = $1`,
      [saleId]
    );
    
    // Restore product stock with error handling
    for (const item of items) {
      try {
        // Ensure all parameters are not undefined
        const quantity = item.quantity ?? 0;
        const productName = item.productName ?? '';
        
        if (quantity > 0 && productName) {
          await query(
            `UPDATE product SET stock = stock + $1 WHERE name = $2`,
            [quantity, productName]
          );
        }
      } catch (stockError) {
        console.warn(`Failed to restore stock for product "${item.productName}":`, stockError);
        // Continue with deletion even if stock restoration fails
      }
    }
    
    // Delete sale items
    await query(
      `DELETE FROM "saleItem" WHERE "saleId" = $1`,
      [saleId]
    );
    
    // Delete sale
    await query(
      `DELETE FROM sale WHERE id = $1`,
      [saleId]
    );
    
    await client.query('COMMIT');
    console.log(`Sale ${saleId} deleted successfully`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to delete sale:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateSale(saleId: string, data: any) {
  const client = await (await getConnection()).connect();
  
  try {
    // Update sale
    await client.query(
      `UPDATE sale SET 
       amount = $1, 
       "paymentMethod" = $2, 
       "staffName" = $3, 
       cabinet = $4, 
       "soldAt" = $5, 
       "updatedAt" = NOW() 
       WHERE id = $6`,
      [data.amount, data.paymentMethod, data.staffName, data.cabinet, data.soldAt, saleId]
    );
    
    // Update items if provided
    if (data.items) {
      // Delete existing items
      await client.query(
        `DELETE FROM "saleItem" WHERE "saleId" = $1`,
        [saleId]
      );
      
      // Insert new items
      for (const item of data.items) {
        await client.query(
          `INSERT INTO "saleItem" ("saleId", "productName", category, quantity, price) 
           VALUES ($1, $2, $3, $4, $5)`,
          [saleId, item.productName, item.category, item.quantity, item.price]
        );
      }
    }
    
    // Return updated sale
    const sales = await getAllSales(data.cabinet || 'main');
    return sales.find(s => s.id === saleId);
    
  } catch (error) {
    console.error('Failed to update sale:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteProduct(id: string) {
  await query(
    'DELETE FROM product WHERE id = $1',
    [id]
  );
}

// Simple Stock Tracking Functions
export async function addStockAddition(data: {
  productId: number;
  quantity: number;
  cabinet: string;
  costPerUnit?: number;
}) {
  // Validate input to prevent negative batches
  if (!data.quantity || data.quantity <= 0) {
    throw new Error('Stock quantity must be greater than 0');
  }
  
  if (data.costPerUnit !== undefined && data.costPerUnit < 0) {
    throw new Error('Cost per unit cannot be negative');
  }

  const result = await query(
    'INSERT INTO stockbatch ("productId", quantity, "costPerUnit", "batchDate", cabinet, status, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), $4, $5, NOW(), NOW()) RETURNING id',
    [data.productId, data.quantity, data.costPerUnit || null, data.cabinet, 'on-shelf']
  );
  
  return {
    id: result[0].id,
    ...data,
    addedDate: new Date().toISOString()
  };
}

export async function getStockAdditions(productId: string, cabinet: string) {
  const rows = await query(
    `SELECT * FROM stockbatch 
     WHERE "productId" = $1 AND cabinet = $2 
     ORDER BY 
       CASE status 
         WHEN 'on-shelf' THEN 1 
         WHEN 'in-storage' THEN 2 
         WHEN 'depleted' THEN 3 
         ELSE 4 
       END,
       quantity DESC,
       "batchDate" ASC`,
    [productId, cabinet]
  );
  
  return rows.map((addition) => ({
    id: addition.id.toString(),
    productId: addition.productId.toString(),
    quantity: addition.quantity,
    costPerUnit: addition.costPerUnit,
    addedDate: new Date(addition.batchDate).toISOString(),
    cabinet: addition.cabinet,
    status: addition.status || 'in-storage',
  }));
}

export async function updateBatchStatus(batchId: string, status: string) {
  const validStatuses = ['on-shelf', 'in-storage', 'reserved', 'damaged', 'sold-out'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid status. Must be one of: ' + validStatuses.join(', '));
  }
  
  await query(
    'UPDATE stockbatch SET status = $1, "updatedAt" = NOW() WHERE id = $2',
    [status, parseInt(batchId)]
  );
  
  return { success: true, status };
}

export async function getCurrentBatchPrice(productId: string, cabinet: string): Promise<number> {
  const rows = await query(
    `SELECT "sellingPrice" FROM stockbatch 
     WHERE "productId" = $1 AND cabinet = $2 AND quantity > 0
     ORDER BY "batchDate" ASC 
     LIMIT 1`,
    [productId, cabinet]
  );
  
  if (rows.length > 0 && rows[0].sellingPrice) {
    return rows[0].sellingPrice;
  }
  
  // Fallback to product price if no batch has selling price
  const productRows = await query(
    'SELECT price FROM product WHERE id = $1 AND cabinet = $2',
    [productId, cabinet]
  );
  
  return productRows.length > 0 ? productRows[0].price : 0;
}

export async function archiveSales(archiveMonth: string, cabinet: string) {
  const client = await (await getConnection()).connect();
  
  try {
    console.log('archiveSales called with:', archiveMonth, cabinet);
    
    // Parse the archive month (format: "YYYY-MM")
    const [year, month] = archiveMonth.split('-').map(Number);
    
    // Use local timezone dates to match database format
    const startDate = new Date(year, month - 1, 1);
    const endDate = month === 12 
      ? new Date(year + 1, 0, 1)  // January of next year
      : new Date(year, month, 1); // First day of next month

    console.log('Archive date range:', startDate, 'to', endDate);

    // Check if there are any sales to archive for this specific month
    const checkResult = await client.query(
      `SELECT COUNT(*) as count FROM sale 
       WHERE date >= $1::timestamp AND date < $2::timestamp 
       AND cabinet = $3 AND archived = false`,
      [startDate, endDate, cabinet]
    );

    console.log('Check result:', checkResult.rows[0]);

    if (parseInt(checkResult.rows[0].count) === 0) {
      return {
        archivedCount: 0,
        message: 'No sales to archive for this month'
      };
    }

    // Update sales only for the specific month
    const result = await client.query(
      `UPDATE sale SET archived = true 
       WHERE date >= $1::timestamp AND date < $2::timestamp 
       AND cabinet = $3 AND archived = false`,
      [startDate, endDate, cabinet]
    );

    return {
      archivedCount: result.rowCount || 0,
      month: archiveMonth
    };
  } catch (error: any) {
    console.error('archiveSales error:', error);
    throw new Error('Failed to archive sales: ' + error.message);
  } finally {
    client.release();
  }
}

export async function unarchiveSales(unarchiveMonth: string, cabinet: string) {
  const client = await (await getConnection()).connect();
  
  try {
    console.log('unarchiveSales called with:', unarchiveMonth, cabinet);
    
    // Parse the unarchive month (format: "YYYY-MM")
    const [year, month] = unarchiveMonth.split('-').map(Number);
    
    // Use local timezone dates to match database format
    const startDate = new Date(year, month - 1, 1);
    const endDate = month === 12 
      ? new Date(year + 1, 0, 1)  // January of next year
      : new Date(year, month, 1); // First day of next month

    console.log('Unarchive date range:', startDate, 'to', endDate);

    // Check if there are any sales to unarchive for this specific month
    const checkResult = await client.query(
      `SELECT COUNT(*) as count FROM sale 
       WHERE date >= $1::timestamp AND date < $2::timestamp 
       AND cabinet = $3 AND archived = true`,
      [startDate, endDate, cabinet]
    );

    console.log('Unarchive check result:', checkResult.rows[0]);

    if (parseInt(checkResult.rows[0].count) === 0) {
      return {
        unarchivedCount: 0,
        message: 'No archived sales to restore for this month'
      };
    }

    // Update sales only for the specific month
    const result = await client.query(
      `UPDATE sale SET archived = false 
       WHERE date >= $1::timestamp AND date < $2::timestamp 
       AND cabinet = $3 AND archived = true
       RETURNING id, date, amount, "paymentMethod", "staffName", cabinet, "soldAt", "referenceNumber", "createdAt"`,
      [startDate, endDate, cabinet]
    );

    // Get the items for the unarchived sales
    const unarchivedSales = result.rows;
    for (const sale of unarchivedSales) {
      const items = await client.query(
        `SELECT * FROM "saleItem" WHERE "saleId" = $1`,
        [sale.id]
      );
      sale.items = items.rows.map(item => ({
        ...item,
        isDiscounted: Boolean(item.isDiscounted)
      }));
    }

    return {
      unarchivedCount: result.rowCount || 0,
      month: unarchiveMonth,
      sales: unarchivedSales
    };
  } catch (error: any) {
    console.error('unarchiveSales error:', error);
    throw new Error('Failed to unarchive sales: ' + error.message);
  } finally {
    client.release();
  }
}

export async function createEmployee(data: {
  name: string;
  username: string;
  password: string;
  role?: string;
  status?: string;
}) {
  const client = await (await getConnection()).connect();
  
  try {
    await client.query('BEGIN');
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const result = await client.query(
      'INSERT INTO employee (name, username, password, role, status, "joinDate", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW()) RETURNING id',
      [data.name, data.username, hashedPassword, data.role || 'staff', data.status || 'active']
    );
    
    await client.query('COMMIT');
    
    return {
      id: result.rows[0].id,
      ...data,
      password: undefined // Don't return password
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateEmployee(id: number, data: {
  name?: string;
  username?: string;
  password?: string;
  role?: string;
  status?: string;
}) {
  const client = await (await getConnection()).connect();
  
  try {
    await client.query('BEGIN');
    
    let updateFields = [];
    let values = [];
    let paramIndex = 1;
    
    if (data.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.username !== undefined) {
      updateFields.push(`username = $${paramIndex++}`);
      values.push(data.username);
    }
    if (data.password !== undefined) {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      updateFields.push(`password = $${paramIndex++}`);
      values.push(hashedPassword);
    }
    if (data.role !== undefined) {
      updateFields.push(`role = $${paramIndex++}`);
      values.push(data.role);
    }
    if (data.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    
    updateFields.push(`"updatedAt" = NOW()`);
    values.push(id);
    
    await client.query(
      `UPDATE employee SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    
    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteEmployee(id: number) {
  const client = await (await getConnection()).connect();
  
  try {
    await client.query('BEGIN');
    
    await client.query(
      'DELETE FROM employee WHERE id = $1',
      [id]
    );
    
    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateUserActivity(username: string) {
  try {
    await query(
      `UPDATE employee SET "lastActivity" = NOW() WHERE username = $1`,
      [username]
    );
    return { success: true };
  } catch (error) {
    console.error('Error updating user activity:', error);
    return { success: false };
  }
}

export async function getOnlineUsers() {
  try {
    // Consider users online if they had activity in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const rows = await query(
      `SELECT id, name, username, role, "lastActivity", 
        CASE 
          WHEN "lastActivity" >= $1 THEN 'online' 
          ELSE 'offline' 
        END as "onlineStatus"
       FROM employee 
       ORDER BY name ASC`,
      [fiveMinutesAgo.toISOString()]
    );
    
    return rows.map(emp => ({
      ...emp,
      isOnline: emp.onlineStatus === 'online'
    }));
  } catch (error) {
    console.error('Error getting online users:', error);
    return [];
  }
}

export async function refreshEmployees() {
  try {
    // This function is called to refresh employee data in the context
    // The actual implementation will be handled by the context
    console.log('Employee data refresh requested');
    return { success: true };
  } catch (error) {
    console.error('Error refreshing employees:', error);
    return { success: false };
  }
}

export async function addStockWithTracking(productId: number, quantity: number, cabinet: string) {
  const client = await (await getConnection()).connect();
  
  try {
    await client.query('BEGIN');
    
    // Add to StockBatch table
    await client.query(
      'INSERT INTO stockbatch ("productId", quantity, "batchDate", cabinet, status, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), $3, $4, NOW(), NOW())',
      [productId, quantity, cabinet, 'on-shelf']
    );
    
    // Update product stock field for backward compatibility
    await client.query(
      'UPDATE product SET stock = stock + $1, "updatedAt" = NOW() WHERE id = $2',
      [quantity, productId]
    );
    
    await client.query('COMMIT');
    
    return { success: true, newStock: quantity };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
