import { NextRequest, NextResponse } from 'next/server';
import { addStockAddition, getStockAdditions, query } from '@/lib/pg-direct';
import { validateStockBatch } from '@/utils/validation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const cabinet = searchParams.get('cabinet') || 'main';
    const batchMode = searchParams.get('batch'); // 'all' for all products

    // Batch mode: get on-shelf stock for all products in cabinet
    if (batchMode === 'all') {
      let queryStr = `
        SELECT 
          p.id as product_id,
          COALESCE(SUM(sb.quantity), 0) as on_shelf_stock
        FROM product p
        LEFT JOIN stockbatch sb ON p.id = sb."productId" 
          AND sb.status = 'on-shelf'
      `;
      
      let queryParams: any[] = [];
      
      if (cabinet !== 'all') {
        queryStr += ` WHERE p.cabinet = $1 AND sb.cabinet = $1`;
        queryParams = [cabinet];
      } else {
        queryStr += ` WHERE sb.cabinet IS NOT NULL`;
      }
      
      queryStr += ` GROUP BY p.id`;
      
      const result = await query(queryStr, queryParams);

      const stockMap: Record<string, number> = {};
      result.forEach((row: any) => {
        stockMap[row.product_id.toString()] = parseInt(row.on_shelf_stock) || 0;
      });

      return NextResponse.json(stockMap);
    }

    // Single product mode (original behavior)
    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required (or use ?batch=all for all products)' },
        { status: 400 }
      );
    }

    // Validate productId is a positive integer
    const productIdNum = parseInt(productId);
    if (isNaN(productIdNum) || productIdNum <= 0) {
      return NextResponse.json(
        { error: 'Product ID must be a positive integer' },
        { status: 400 }
      );
    }

    // Validate cabinet parameter
    if (cabinet.length > 50) {
      return NextResponse.json(
        { error: 'Cabinet name must not exceed 50 characters' },
        { status: 400 }
      );
    }

    const batches = await getStockAdditions(productId, cabinet);
    return NextResponse.json(batches);
  } catch (error: any) {
    console.error('Error fetching stock batches:', error);
    const errorMessage = error?.message || error?.toString() || '';
    
    // Check if it's a table not found error
    if (errorMessage.includes('Table') || errorMessage.includes('not found') || errorMessage.includes("doesn't exist")) {
      // Return empty array instead of error when table doesn't exist
      return NextResponse.json([]);
    }
    
    const finalErrorMessage = error instanceof Error ? error.message : 'Failed to fetch stock batches';
    return NextResponse.json(
      { error: finalErrorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body structure
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body. Must be a JSON object.' },
        { status: 400 }
      );
    }

    // Use comprehensive validation
    const validation = validateStockBatch(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validation.errors.map(err => `${err.field}: ${err.message}`).join('; ')
        },
        { status: 400 }
      );
    }

    const { productId, quantity, costPerUnit, cabinet } = body;

    // Additional business logic validation
    if (quantity > 10000) {
      return NextResponse.json(
        { error: 'Quantity too large. Maximum allowed is 10,000 units per batch.' },
        { status: 400 }
      );
    }

    // Add stock batch to tracking
    const batch = await addStockAddition({
      productId: parseInt(productId),
      quantity: parseInt(quantity),
      cabinet: cabinet || 'main',
      costPerUnit: costPerUnit ? parseFloat(costPerUnit) : undefined,
    });

    // AUTO BATCH TRANSFER: Check if there's a depleted batch that should be transferred
    console.log('=== CHECKING BATCH TRANSFER AFTER RESTOCK ===');
    
    // Get all batches for this product (including storage) ordered by date
    const allBatches = await query(
      'SELECT id, quantity, status, "batchDate" FROM stockbatch WHERE "productId" = $1 AND cabinet = $2 ORDER BY "batchDate" ASC',
      [parseInt(productId), cabinet || 'main']
    ) as any[];
    
    console.log('All batches after restock:', allBatches.map(b => ({ id: b.id, quantity: b.quantity, status: b.status })));
    
    // Find ALL batches that are 'on-shelf' or 'in-storage' with 0 quantity
    const depletedOnShelfBatches = allBatches.filter(batch => ['on-shelf', 'in-storage'].includes(batch.status) && Number(batch.quantity) === 0);
    
    console.log('Depleted on-shelf batches found:', depletedOnShelfBatches.length);
    
    if (depletedOnShelfBatches.length > 0) {
      console.log(`Processing ${depletedOnShelfBatches.length} depleted batches...`);
      
      for (const depletedBatch of depletedOnShelfBatches) {
        console.log(`Processing depleted batch ${depletedBatch.id}...`);
        
        // Find the next batch with quantity > 0 (could be 'storage' or 'on-shelf')
        const depletedBatchIndex = allBatches.findIndex(batch => batch.id === depletedBatch.id);
        const remainingBatches = allBatches.slice(depletedBatchIndex + 1);
        
        console.log('Remaining batches after depleted batch:', remainingBatches.map(b => ({ id: b.id, quantity: b.quantity, status: b.status })));
        
        // Find the next batch that has stock
        const nextBatch = remainingBatches.find(batch => Number(batch.quantity) > 0);
        
        if (nextBatch) {
          console.log(`Found next batch ${nextBatch.id} with ${nextBatch.quantity} units, status: ${nextBatch.status}`);
          
          // Update the depleted batch to 'depleted' status
          console.log(`Updating batch ${depletedBatch.id} from '${depletedBatch.status}' to 'depleted'`);
          await query(
            'UPDATE stockbatch SET status = $1, "updatedAt" = NOW() WHERE id = $2',
            ['depleted', depletedBatch.id]
          );
          
          // Promote the next batch to the depleted batch's status (on-shelf or in-storage)
          console.log(`Updating batch ${nextBatch.id} from '${nextBatch.status}' to '${depletedBatch.status}'`);
          await query(
            'UPDATE stockbatch SET status = $1, "updatedAt" = NOW() WHERE id = $2',
            [depletedBatch.status, nextBatch.id]
          );
          
          console.log(`✅ Batch transfer complete: ${depletedBatch.id} -> ${nextBatch.id}`);
          
          // Update the allBatches array to reflect the change
          const updatedNextBatch = allBatches.find(batch => batch.id === nextBatch.id);
          if (updatedNextBatch) {
            updatedNextBatch.status = depletedBatch.status;
          }
          const updatedDepletedBatch = allBatches.find(batch => batch.id === depletedBatch.id);
          if (updatedDepletedBatch) {
            updatedDepletedBatch.status = 'depleted';
          }
        } else {
          console.log(`❌ No next batch available with stock for depleted batch ${depletedBatch.id}`);
        }
      }
    } else {
      console.log('✅ No depleted on-shelf batches found, no transfer needed');
    }

    // Update the product's stock
    await query(
      'UPDATE product SET stock = stock + $1, "updatedAt" = NOW() WHERE id = $2',
      [parseInt(quantity), parseInt(productId)]
    );

    return NextResponse.json(batch, { status: 201 });
  } catch (error: any) {
    console.error('Error creating stock batch:', error);
    const errorMessage = error?.message || error?.toString() || '';
    
    // Check if it's a table not found error
    if (errorMessage.includes('Table') || errorMessage.includes('not found') || errorMessage.includes("doesn't exist")) {
      return NextResponse.json(
        { error: 'Batch tracking not available. Stock is managed as single quantity.' },
        { status: 400 }
      );
    }
    
    // Check for foreign key constraint violation
    if (errorMessage.includes('foreign key constraint') || errorMessage.includes('1452')) {
      return NextResponse.json(
        { error: 'Invalid Product ID. The specified product does not exist.' },
        { status: 400 }
      );
    }
    
    // Check for database constraint violations
    if (errorMessage.includes('CHECK constraint') || errorMessage.includes('3819')) {
      return NextResponse.json(
        { error: 'Invalid data: Values violate database constraints (e.g., negative quantities not allowed).' },
        { status: 400 }
      );
    }
    
    const finalErrorMessage = error instanceof Error ? error.message : 'Failed to create stock batch';
    return NextResponse.json(
      { error: finalErrorMessage },
      { status: 500 }
    );
  }
}
