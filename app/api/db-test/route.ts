import { NextResponse } from 'next/server';
import { query } from '@/lib/pg-direct';

interface QueryResult {
  [key: string]: any;
}

export async function GET() {
  try {
    // Test the database connection
    const connectionTest = await query('SELECT 1 as test') as QueryResult[];
    console.log('Database test result:', connectionTest);
    
    // Check which tables exist
    const allTables = await query('SHOW TABLES') as QueryResult[];
    const tableNames = allTables.map((row: any) => Object.values(row)[0] as string);
    
    // Check if product table exists
    const productTableExists = tableNames.includes('product');
    const categoryTableExists = tableNames.includes('category');
    
    let tableStructure = null;
    if (productTableExists) {
      tableStructure = await query('DESCRIBE product') as QueryResult[];
    }
    
    // Get table counts
    let productCount = 0;
    let categoryCount = 0;
    
    if (productTableExists) {
      const countResult = await query('SELECT COUNT(*) as count FROM product') as any[];
      if (countResult && countResult.length > 0 && countResult[0]) {
        productCount = countResult[0].count;
      }
    }
    
    if (categoryTableExists) {
      const countResult = await query('SELECT COUNT(*) as count FROM category') as any[];
      if (countResult && countResult.length > 0 && countResult[0]) {
        categoryCount = countResult[0].count;
      }
    }
    
    return NextResponse.json({
      connected: true,
      tables: {
        all: tableNames,
        product: {
          exists: productTableExists,
          structure: tableStructure,
          count: productCount
        },
        category: {
          exists: categoryTableExists,
          count: categoryCount
        }
      }
    });
  } catch (error) {
    console.error('Database test failed:', error);
    return NextResponse.json(
      { 
        error: 'Database connection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
