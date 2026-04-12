import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

let pool: Pool | null = null;
let saleIdempotencyReady: Promise<void> | null = null;

export async function getConnection() {
  if (!pool) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 10, // Better concurrency for multiple active users
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

/** Adds optional inventory / POS columns (idempotent). */
async function ensureProductExtendedColumns(): Promise<void> {
  const stmts = [
    `ALTER TABLE product ADD COLUMN IF NOT EXISTS cost_price NUMERIC(14,2)`,
    `ALTER TABLE product ADD COLUMN IF NOT EXISTS purchase_date DATE`,
    `ALTER TABLE product ADD COLUMN IF NOT EXISTS purchase_place TEXT`,
    `ALTER TABLE product ADD COLUMN IF NOT EXISTS supplier_name TEXT`,
    `ALTER TABLE product ADD COLUMN IF NOT EXISTS dim_length_cm NUMERIC(12,3)`,
    `ALTER TABLE product ADD COLUMN IF NOT EXISTS dim_width_cm NUMERIC(12,3)`,
    `ALTER TABLE product ADD COLUMN IF NOT EXISTS dim_height_cm NUMERIC(12,3)`,
    `ALTER TABLE product ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(12,3)`,
    `ALTER TABLE product ADD COLUMN IF NOT EXISTS image_url TEXT`,
    `ALTER TABLE product ADD COLUMN IF NOT EXISTS "lastRestockDate" TIMESTAMP`,
    `ALTER TABLE product ADD COLUMN IF NOT EXISTS created_by TEXT`,
    `ALTER TABLE product ADD COLUMN IF NOT EXISTS updated_by TEXT`,
  ];
  for (const sql of stmts) {
    try {
      await query(sql);
    } catch (e) {
      console.warn('[ensureProductExtendedColumns]', sql, e);
    }
  }
}

function mapProductFromDbRow(product: any, lastRestockDate: string | null): Record<string, unknown> {
  // Prefer calculatedStock from stockbatch SUM, but fall back to product.stock for freshly
  // created products whose stock batch hasn't been committed yet.
  const calcStock = parseInt(String(product.calculatedStock ?? 0), 10) || 0;
  const dbStock = parseInt(String(product.stock ?? 0), 10) || 0;
  const stockValue = Math.max(calcStock, dbStock);
  const costRaw = product.cost_price;
  const costNum = costRaw != null && costRaw !== '' ? Number(costRaw) : NaN;
  const pd = product.purchase_date;
  const purchaseDateStr =
    pd == null
      ? undefined
      : typeof pd === 'string'
        ? pd.slice(0, 10)
        : pd instanceof Date
          ? pd.toISOString().slice(0, 10)
          : String(pd).slice(0, 10);

  const formatAuditDateTime = (v: unknown): string | undefined => {
    if (v == null || v === '') return undefined;
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' });
  };

  return {
    id: String(product.id),
    name: product.name,
    sku: product.sku || `SKU-${product.id}`,
    quantity: stockValue,
    price: Number(product.price) || 0,
    costPrice: Number.isFinite(costNum) ? costNum : undefined,
    category: product.categoryName || 'Others',
    categoryId: product.categoryId,
    stock: stockValue,
    location: 'physical' as const,
    cabinet: product.cabinet,
    lastUpdated: product.updatedAt ? new Date(product.updatedAt).toLocaleDateString('en-CA') : '',
    createdBy: product.created_by || undefined,
    lastUpdatedBy: product.updated_by || undefined,
    dateCreated: formatAuditDateTime(product.createdAt),
    lastModifiedDate: formatAuditDateTime(product.updatedAt),
    lastRestockDate: lastRestockDate || undefined,
    description: product.description || undefined,
    purchaseDate: purchaseDateStr,
    purchasePlace: product.purchase_place || undefined,
    supplierName: product.supplier_name || undefined,
    dimLengthCm:
      product.dim_length_cm != null && product.dim_length_cm !== ''
        ? Number(product.dim_length_cm)
        : undefined,
    dimWidthCm:
      product.dim_width_cm != null && product.dim_width_cm !== ''
        ? Number(product.dim_width_cm)
        : undefined,
    dimHeightCm:
      product.dim_height_cm != null && product.dim_height_cm !== ''
        ? Number(product.dim_height_cm)
        : undefined,
    weightKg:
      product.weight_kg != null && product.weight_kg !== '' ? Number(product.weight_kg) : undefined,
    imageUrl: product.image_url || undefined,
  };
}

async function ensureSaleIdempotencySchema(client: any) {
  if (!saleIdempotencyReady) {
    saleIdempotencyReady = (async () => {
      await client.query(`ALTER TABLE sale ADD COLUMN IF NOT EXISTS "requestKey" TEXT`);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS sale_request_key_unique ON sale("requestKey")`);
    })().catch((error) => {
      saleIdempotencyReady = null;
      throw error;
    });
  }

  await saleIdempotencyReady;
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
      // Parse client timestamp and subtract 8 hours
      const date = new Date(clientTimestamp);
      const adjustedTime = new Date(date.getTime() - (8 * 60 * 60 * 1000));
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
      // Fallback: use current local time minus 8 hours
      const now = new Date();
      const adjustedTime = new Date(now.getTime() - (8 * 60 * 60 * 1000));
      const month = adjustedTime.getMonth() + 1;
      const day = adjustedTime.getDate();
      const year = adjustedTime.getFullYear();
      let hours = adjustedTime.getHours();
      const minutes = adjustedTime.getMinutes();
      const seconds = adjustedTime.getSeconds();
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
      // Parse client timestamp and subtract 8 hours
      const date = new Date(clientTimestamp);
      const adjustedTime = new Date(date.getTime() - (8 * 60 * 60 * 1000));
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
      // Fallback: use current local time minus 8 hours
      const now = new Date();
      const adjustedTime = new Date(now.getTime() - (8 * 60 * 60 * 1000));
      const month = adjustedTime.getMonth() + 1;
      const day = adjustedTime.getDate();
      const year = adjustedTime.getFullYear();
      let hours = adjustedTime.getHours();
      const minutes = adjustedTime.getMinutes();
      const seconds = adjustedTime.getSeconds();
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
      'SELECT id, name, username, role, "joinDate", "lastLogin", "lastLogout", "createdAt", "updatedAt" FROM employee ORDER BY role ASC, name ASC'
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
  await ensureProductExtendedColumns();
  const productRows = await query(
    `SELECT p.*, c.name as "categoryName", 
            COALESCE(SUM(sb.quantity), 0) as "calculatedStock"
     FROM product p 
     LEFT JOIN category c ON p."categoryId" = c.id 
     LEFT JOIN stockbatch sb ON p.id = sb."productId" AND sb.cabinet = $1
     WHERE p.cabinet = $2 
     GROUP BY p.id, c.name
     ORDER BY p."createdAt" DESC`,
    [cabinet, cabinet]
  );

  const restockRows = await query(
    `SELECT "productId", MAX("batchDate") as "lastRestockDate"
     FROM stockbatch 
     WHERE cabinet = $1
     GROUP BY "productId"`,
    [cabinet]
  );

  return productRows.map((product) => {
    const restockInfo = restockRows.find((r) => r.productId === product.id);
    const lastRestockDate = restockInfo?.lastRestockDate
      ? new Date(restockInfo.lastRestockDate).toLocaleDateString('en-CA')
      : null;
    return mapProductFromDbRow(product, lastRestockDate);
  });
}

export async function getAllProductsAllCabinets() {
  await ensureProductExtendedColumns();
  const productRows = await query(
    `SELECT p.*, c.name as "categoryName", 
            COALESCE(SUM(sb.quantity), 0) as "calculatedStock"
     FROM product p 
     LEFT JOIN category c ON p."categoryId" = c.id 
     LEFT JOIN stockbatch sb ON p.id = sb."productId" AND sb.cabinet = p.cabinet
     GROUP BY p.id, c.name
     ORDER BY p."createdAt" DESC`
  );

  const restockRows = await query(
    `SELECT "productId", MAX("batchDate") as "lastRestockDate"
     FROM stockbatch 
     GROUP BY "productId"`
  );

  return productRows.map((product) => {
    const restockInfo = restockRows.find((r) => r.productId === product.id);
    const lastRestockDate = restockInfo?.lastRestockDate
      ? new Date(restockInfo.lastRestockDate).toLocaleDateString('en-CA')
      : null;
    return mapProductFromDbRow(product, lastRestockDate);
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
  costPrice?: number | null;
  purchaseDate?: string | null;
  purchasePlace?: string | null;
  supplierName?: string | null;
  dimLengthCm?: number | null;
  dimWidthCm?: number | null;
  dimHeightCm?: number | null;
  weightKg?: number | null;
  imageUrl?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}) {
  const client = await (await getConnection()).connect();

  try {
    await client.query('BEGIN');
    await ensureProductExtendedColumns();

    console.log('Creating product with data:', data);

    if (data.sku) {
      const skuExists = await checkSkuExists(data.sku, data.cabinet);
      if (skuExists) {
        throw new Error(`SKU '${data.sku}' already exists in cabinet '${data.cabinet}'. Please use a different SKU.`);
      }
    }

    const tableCheck = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product')"
    );
    if (!tableCheck.rows[0].exists) {
      throw new Error('Product table does not exist');
    }

    const auditUser =
      (data.createdBy && String(data.createdBy).trim()) ||
      (data.updatedBy && String(data.updatedBy).trim()) ||
      null;

    const result = await client.query(
      `INSERT INTO product (
        name, sku, description, price, stock, cabinet, "categoryId",
        cost_price, purchase_date, purchase_place, supplier_name,
        dim_length_cm, dim_width_cm, dim_height_cm, weight_kg, image_url,
        created_by, updated_by,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, COALESCE($2, NULL::varchar), COALESCE($3, NULL::text), $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()
      ) RETURNING id`,
      [
        data.name,
        data.sku,
        data.description ?? null,
        data.price,
        data.stock,
        data.cabinet,
        data.categoryId,
        data.costPrice ?? null,
        data.purchaseDate || null,
        data.purchasePlace ?? null,
        data.supplierName ?? null,
        data.dimLengthCm ?? null,
        data.dimWidthCm ?? null,
        data.dimHeightCm ?? null,
        data.weightKg ?? null,
        data.imageUrl ?? null,
        auditUser,
        auditUser,
      ]
    );

    const productId = result.rows[0].id;
    if (!productId) {
      throw new Error('Failed to insert product - no ID returned from database');
    }

    await client.query('COMMIT');

    const full = await getProductById(String(productId));
    if (!full) throw new Error('Failed to load product after create');
    console.log('Product created successfully:', full.id);
    return full as any;
    
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
    
    const sales =
      cabinet === "all"
        ? await query(
            `SELECT * FROM sale WHERE COALESCE(archived, false) = false ORDER BY "createdAt" DESC`
          )
        : await query(
            `SELECT * FROM sale WHERE cabinet = $1 AND COALESCE(archived, false) = false ORDER BY "createdAt" DESC`,
            [cabinet]
          );

    console.log(
      `getAllSales: Found ${sales.length} active (non-archived) sales for cabinet '${cabinet}'`
    );
    
    if (sales.length === 0) {
      return sales;
    }

    // Fetch all sale items in one query (avoid N+1 item queries under load).
    const saleIds = sales.map(sale => sale.id);
    const allItems = await query(
      `SELECT * FROM "saleItem" WHERE "saleId" = ANY($1::text[])`,
      [saleIds]
    );
    const itemsBySaleId = new Map<string, any[]>();
    for (const item of allItems) {
      const list = itemsBySaleId.get(item.saleId) || [];
      list.push({
        ...item,
        isDiscounted: Boolean(item.isDiscounted)
      });
      itemsBySaleId.set(item.saleId, list);
    }

    for (const sale of sales) {
      sale.items = itemsBySaleId.get(sale.id) || [];
    }
    
    return sales;
  } catch (error) {
    console.error('Failed to fetch sales:', error);
    throw new Error('Failed to fetch sales from database');
  }
}

// Get sales within a date range (for dashboard today sales and date filtering)
export async function getSalesByDateRange(startDate: Date, endDate: Date, cabinet?: string) {
  try {
    // Ensure archived column exists
    try {
      await query(`ALTER TABLE sale ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false`);
    } catch (alterError) {
      // Ignore errors if column already exists
    }
    
    let sql: string;
    let params: any[];
    
    if (cabinet && cabinet !== 'all') {
      // Filter by both date range and cabinet
      sql = `
        SELECT * FROM sale 
        WHERE date >= $1::timestamp 
          AND date < $2::timestamp 
          AND cabinet = $3 
          AND archived = false 
        ORDER BY date DESC
      `;
      params = [startDate.toISOString(), endDate.toISOString(), cabinet];
    } else {
      // Filter by date range only (all cabinets)
      sql = `
        SELECT * FROM sale 
        WHERE date >= $1::timestamp 
          AND date < $2::timestamp 
          AND archived = false 
        ORDER BY date DESC
      `;
      params = [startDate.toISOString(), endDate.toISOString()];
    }
    
    const sales = await query(sql, params);
    console.log(`getSalesByDateRange: Found ${sales.length} sales between ${startDate.toISOString()} and ${endDate.toISOString()}${cabinet ? ` for cabinet '${cabinet}'` : ' for all cabinets'}`);
    
    if (sales.length === 0) {
      return sales;
    }

    // Fetch all sale items in one query (avoid N+1 item queries).
    const saleIds = sales.map(sale => sale.id);
    const allItems = await query(
      `SELECT * FROM "saleItem" WHERE "saleId" = ANY($1::text[])`,
      [saleIds]
    );
    const itemsBySaleId = new Map<string, any[]>();
    for (const item of allItems) {
      const list = itemsBySaleId.get(item.saleId) || [];
      list.push({
        ...item,
        isDiscounted: Boolean(item.isDiscounted)
      });
      itemsBySaleId.set(item.saleId, list);
    }

    for (const sale of sales) {
      sale.items = itemsBySaleId.get(sale.id) || [];
    }
    
    return sales;
  } catch (error) {
    console.error('Failed to fetch sales by date range:', error);
    throw new Error('Failed to fetch sales from database');
  }
}

async function getSaleById(saleId: string) {
  const saleRows = await query(
    `SELECT * FROM sale WHERE id = $1 LIMIT 1`,
    [saleId]
  );
  if (saleRows.length === 0) return null;

  const itemRows = await query(
    `SELECT * FROM "saleItem" WHERE "saleId" = $1`,
    [saleId]
  );

  return {
    ...saleRows[0],
    items: itemRows.map((item) => ({
      ...item,
      isDiscounted: Boolean(item.isDiscounted)
    }))
  };
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
  date?: string;
  amount: number;
  paymentMethod: string;
  staffName: string;
  cabinet: string;
  soldAt: string;
  requestKey?: string;
  referenceNumber?: string;
  bypassStockCheck?: boolean;
  forceCreate?: boolean;
  emergencySync?: boolean;
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
    
    // Ensure idempotency column/index exist before create/check.
    await ensureSaleIdempotencySchema(client);

    // If this request key was already processed, return existing sale immediately.
    if (data.requestKey) {
      const existingSaleRows = await client.query(
        `SELECT id FROM sale WHERE "requestKey" = $1 LIMIT 1`,
        [data.requestKey]
      );

      if (existingSaleRows.rows.length > 0) {
        await client.query('ROLLBACK');
        const existingSaleId = existingSaleRows.rows[0].id;
        const existingSale = await getSaleById(existingSaleId);
        if (existingSale) {
          return existingSale;
        }
      }
    }

    // Create the sale
    const saleId = randomUUID();
    const parsedSaleDate = data.date ? new Date(data.date) : new Date();
    const saleDate = Number.isNaN(parsedSaleDate.getTime()) ? new Date() : parsedSaleDate;
    await client.query(
      `INSERT INTO sale (id, date, amount, "paymentMethod", "staffName", cabinet, "soldAt", "referenceNumber", "requestKey", "createdAt", "updatedAt") 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [saleId, saleDate, data.amount, data.paymentMethod, data.staffName, data.cabinet, data.soldAt, data.referenceNumber || null, data.requestKey || null]
    );
    
    // Create sale items and update product stock with batch tracking
    for (const item of data.items) {
      if (item.quantity <= 0 || item.price < 0) {
        throw new Error('Invalid item quantity or price');
      }
      
      await client.query(
        `INSERT INTO "saleItem" ("saleId", "productName", category, quantity, price, "originalPrice", "costPrice", "unitCost", "isDiscounted", profit) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [saleId, item.productName, item.category, item.quantity, item.price, item.originalPrice || null, item.costPrice || null, item.costPrice || 0, item.isDiscounted || false, item.profit || null]
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
        // Skip stock check if bypass is enabled
        if (data.bypassStockCheck || data.forceCreate || data.emergencySync) {
          console.log(`🔓 BYPASSING STOCK CHECK for ${item.productName} (bypass: ${data.bypassStockCheck}, force: ${data.forceCreate}, emergency: ${data.emergencySync})`);
        } else {
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
    const createdSale = await getSaleById(saleId);
    return createdSale;
    
  } catch (error) {
    await client.query('ROLLBACK');
    // Handle unique conflict on requestKey safely by returning the existing sale.
    if (data.requestKey && (error as any)?.code === '23505') {
      const existingRows = await query(
        `SELECT id FROM sale WHERE "requestKey" = $1 LIMIT 1`,
        [data.requestKey]
      );
      if (existingRows.length > 0) {
        const existingSaleId = existingRows[0].id;
        const existingSale = await getSaleById(existingSaleId);
        if (existingSale) {
          return existingSale;
        }
      }
    }
    console.error('Error creating sale:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function getProductById(id: string) {
  await ensureProductExtendedColumns();
  const rows = await query(
    `SELECT p.*, c.name as "categoryName", 
            COALESCE(SUM(sb.quantity), 0) as "calculatedStock"
     FROM product p 
     LEFT JOIN category c ON p."categoryId" = c.id 
     LEFT JOIN stockbatch sb ON p.id = sb."productId"
     WHERE p.id = $1
     GROUP BY p.id, c.name`,
    [id]
  );

  if (rows.length === 0) return null;

  const product = rows[0];
  const lastRestockRows = await query(
    `SELECT MAX("batchDate") as "lastRestockDate" FROM stockbatch WHERE "productId" = $1`,
    [id]
  );
  const lr = lastRestockRows[0]?.lastRestockDate;
  const lastRestockDate = lr ? new Date(lr).toLocaleDateString('en-CA') : null;
  return mapProductFromDbRow(product, lastRestockDate) as any;
}

export type ProductUpdatePayload = Partial<{
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  cabinet: string;
  categoryId: number;
  description: string | null;
  lastRestockDate: string | null;
  costPrice: number | null;
  purchaseDate: string | null;
  purchasePlace: string | null;
  supplierName: string | null;
  dimLengthCm: number | null;
  dimWidthCm: number | null;
  dimHeightCm: number | null;
  weightKg: number | null;
  imageUrl: string | null;
  updatedBy: string | null;
}>;

export async function updateProduct(id: string, data: ProductUpdatePayload) {
  const client = await (await getConnection()).connect();

  try {
    await client.query('BEGIN');
    await ensureProductExtendedColumns();

    const idNum = parseInt(id, 10);
    const curRes = await client.query('SELECT * FROM product WHERE id = $1', [idNum]);
    if (curRes.rows.length === 0) {
      throw new Error('Product not found');
    }
    const cur = curRes.rows[0];

    const name = data.name !== undefined ? data.name : cur.name;
    const sku = data.sku !== undefined ? data.sku : cur.sku;
    const price = data.price !== undefined ? Number(data.price) : Number(cur.price);
    const stock = data.stock !== undefined ? Number(data.stock) : Number(cur.stock);
    const cabinetVal = data.cabinet !== undefined ? data.cabinet : cur.cabinet;
    const categoryId = data.categoryId !== undefined ? data.categoryId : cur.categoryId;
    const description = data.description !== undefined ? data.description : cur.description;
    const cost_price = data.costPrice !== undefined ? data.costPrice : cur.cost_price;
    const purchase_date =
      data.purchaseDate !== undefined ? data.purchaseDate || null : cur.purchase_date;
    const purchase_place =
      data.purchasePlace !== undefined ? data.purchasePlace : cur.purchase_place;
    const supplier_name =
      data.supplierName !== undefined ? data.supplierName : cur.supplier_name;
    const dim_length_cm =
      data.dimLengthCm !== undefined ? data.dimLengthCm : cur.dim_length_cm;
    const dim_width_cm = data.dimWidthCm !== undefined ? data.dimWidthCm : cur.dim_width_cm;
    const dim_height_cm =
      data.dimHeightCm !== undefined ? data.dimHeightCm : cur.dim_height_cm;
    const weight_kg = data.weightKg !== undefined ? data.weightKg : cur.weight_kg;
    const image_url = data.imageUrl !== undefined ? data.imageUrl : cur.image_url;
    const lastRestockDateVal =
      data.lastRestockDate !== undefined ? data.lastRestockDate : cur.lastRestockDate;
    const updated_by =
      data.updatedBy !== undefined
        ? data.updatedBy && String(data.updatedBy).trim()
          ? String(data.updatedBy).trim()
          : null
        : cur.updated_by;

    if (sku) {
      const skuExists = await checkSkuExists(sku, cabinetVal, idNum);
      if (skuExists) {
        throw new Error(`SKU '${sku}' already exists in cabinet '${cabinetVal}'. Please use a different SKU.`);
      }
    }

    await client.query(
      `UPDATE product SET
        name = $1,
        sku = $2,
        price = $3,
        stock = $4,
        cabinet = $5,
        "categoryId" = $6,
        description = $7,
        cost_price = $8,
        purchase_date = $9,
        purchase_place = $10,
        supplier_name = $11,
        dim_length_cm = $12,
        dim_width_cm = $13,
        dim_height_cm = $14,
        weight_kg = $15,
        image_url = $16,
        "lastRestockDate" = $17,
        updated_by = $18,
        "updatedAt" = NOW()
      WHERE id = $19`,
      [
        name,
        sku || null,
        price,
        stock,
        cabinetVal,
        categoryId,
        description ?? null,
        cost_price ?? null,
        purchase_date,
        purchase_place ?? null,
        supplier_name ?? null,
        dim_length_cm ?? null,
        dim_width_cm ?? null,
        dim_height_cm ?? null,
        weight_kg ?? null,
        image_url ?? null,
        lastRestockDateVal ?? null,
        updated_by ?? null,
        idNum,
      ]
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

export async function updateProductStock(id: string, stock: number) {
  const client = await (await getConnection()).connect();
  
  try {
    await client.query('BEGIN');
    
    // Validate stock is not negative
    if (stock < 0) {
      throw new Error('Stock cannot be negative');
    }
    
    // Update only the stock field
    await client.query(
      'UPDATE product SET stock = $1, "updatedAt" = NOW() WHERE id = $2',
      [stock, id]
    );
    
    await client.query('COMMIT');
    
    return await getProductById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating product stock:', error);
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
  sellingPrice?: number;
}) {
  // Validate input to prevent negative batches
  if (!data.quantity || data.quantity <= 0) {
    throw new Error('Stock quantity must be greater than 0');
  }
  
  if (data.costPerUnit !== undefined && data.costPerUnit < 0) {
    throw new Error('Cost per unit cannot be negative');
  }

  // Dynamically determine appropriate status using FIFO principles
  const existingBatches = await query(
    `SELECT id FROM stockbatch WHERE "productId" = $1 AND cabinet = $2 AND status = 'on-shelf' AND quantity > 0 LIMIT 1`,
    [data.productId, data.cabinet]
  );
  const determineStatus = existingBatches.length > 0 ? 'in-storage' : 'on-shelf';

  const result = await query(
    'INSERT INTO stockbatch ("productId", quantity, "initialQuantity", "costPerUnit", "sellingPrice", "batchDate", cabinet, status, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, NOW(), NOW()) RETURNING id',
    [data.productId, data.quantity, data.quantity, data.costPerUnit || null, data.sellingPrice || null, data.cabinet, determineStatus]
  );
  
  return {
    id: result[0].id,
    ...data,
    addedDate: new Date().toISOString()
  };
}

export async function getStockAdditions(productId: string, cabinet: string) {
  let rows = await query(
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

  // If product shows stock but has no batches (common after legacy data / failed sync),
  // create a single on-shelf batch so "Stock History" matches displayed stock.
  if (!rows || rows.length === 0) {
    const productRows = await query(
      'SELECT stock FROM product WHERE id = $1 AND cabinet = $2',
      [productId, cabinet]
    );
    const stock = Number(productRows?.[0]?.stock ?? 0) || 0;
    if (stock > 0) {
      try {
        await query(
          'INSERT INTO stockbatch ("productId", quantity, "initialQuantity", "batchDate", cabinet, status, "createdAt", "updatedAt", notes) VALUES ($1, $2, $3, NOW(), $4, $5, NOW(), NOW(), $6)',
          [productId, stock, stock, cabinet, 'on-shelf', 'Backfilled batch (missing history)']
        );
        rows = await query(
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
      } catch {
        // If backfill fails, fall through and return empty history.
      }
    }
  }
  
  return rows.map((addition) => ({
    id: addition.id.toString(),
    productId: addition.productId.toString(),
    quantity: addition.quantity,
    initialQuantity: addition.initialQuantity,
    costPerUnit: addition.costPerUnit,
    addedDate: new Date(addition.batchDate).toISOString(),
    cabinet: addition.cabinet,
    status: addition.status || 'in-storage',
    notes: addition.notes,
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
