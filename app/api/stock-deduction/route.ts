import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/pg-direct';

// GET handler for testing
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ 
      message: 'Stock deduction API is working',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'API test failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('=== STOCK DEDUCTION API CALLED ===');
  
  try {
    let body;
    try {
      body = await request.json();
      console.log('Request body parsed successfully:', body);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    console.log('Stock deduction request body:', body);
    
    // Simple validation
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    
    const { productId, quantity, cabinet, notes } = body;
    
    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
    }
    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    }
    if (!cabinet) {
      return NextResponse.json({ error: 'Missing cabinet' }, { status: 400 });
    }

    console.log('=== STOCK DEDUCTION API DEBUG ===');
    console.log('Request received:', { productId, quantity, cabinet, notes });
    
    // Additional business logic validation
    if (quantity > 10000) {
      return NextResponse.json(
        { error: 'Quantity too large. Maximum allowed is 10,000 units per deduction.' },
        { status: 400 }
      );
    }

    // First, try a simple query to see if the product exists in the specific cabinet
    const simpleProductRows = await query(
      'SELECT id, name, stock, cabinet FROM product WHERE id = $1 AND cabinet = $2',
      [parseInt(productId), cabinet]
    ) as any[];

    console.log('Product query for id:', productId, 'cabinet:', cabinet, 'result:', simpleProductRows);

    // Check if product exists
    if (!simpleProductRows || simpleProductRows.length === 0) {
      // Check if product exists in ANY cabinet
      const anyCabinetRows = await query(
        'SELECT id, name, stock, cabinet FROM product WHERE id = $1',
        [parseInt(productId)]
      ) as any[];
      
      if (anyCabinetRows && anyCabinetRows.length > 0) {
        return NextResponse.json(
          { error: `Product found in cabinet '${anyCabinetRows[0].cabinet}' but not in '${cabinet}'` },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: `Product with ID ${productId} not found` },
        { status: 404 }
      );
    }

    const simpleProduct = simpleProductRows[0];
    console.log('Simple product data:', simpleProduct);

    // CRITICAL FIX: First check ALL batches and handle transfers BEFORE any validation
    console.log('=== CRITICAL: CHECKING BATCHES BEFORE VALIDATION ===');
    
    // Get ALL batches for this product (including all statuses)
    const allBatches = await query(
      'SELECT id, quantity, status, "batchDate" FROM stockbatch WHERE "productId" = $1 AND cabinet = $2 ORDER BY "batchDate" ASC',
      [parseInt(productId), cabinet]
    ) as any[];
    
    console.log('All batches found:', allBatches.map(b => ({ id: b.id, quantity: b.quantity, status: b.status })));
    
    // Check if there are depleted on-shelf batches that need transfer
    const depletedBatches = allBatches.filter(batch => ['on-shelf', 'in-storage'].includes(batch.status) && Number(batch.quantity) === 0);
    console.log('Depleted on-shelf batches:', depletedBatches.length);
    
    if (depletedBatches.length > 0) {
      console.log('TRANSFERRING DEPLETED BATCHS...');
      
      for (const depletedBatch of depletedBatches) {
        // Find next batch with stock (any status)
        const depletedIndex = allBatches.findIndex(b => b.id === depletedBatch.id);
        const remainingBatches = allBatches.slice(depletedIndex + 1);
        const nextBatchWithStock = remainingBatches.find(b => Number(b.quantity) > 0);
        
        if (nextBatchWithStock) {
          console.log(`Transfer: Batch ${depletedBatch.id} (0 units) -> Batch ${nextBatchWithStock.id} (${nextBatchWithStock.quantity} units)`);
          
          // Mark depleted batch as depleted
          await query(
            'UPDATE stockbatch SET status = $1, "updatedAt" = NOW() WHERE id = $2',
            ['depleted', depletedBatch.id]
          );
          
          // Promote next batch to the depleted batch's status (on-shelf or in-storage)
          await query(
            'UPDATE stockbatch SET status = $1, "updatedAt" = NOW() WHERE id = $2',
            [depletedBatch.status, nextBatchWithStock.id]
          );
          
          console.log('Transfer complete!');
        } else {
          console.log(`No batch with stock found after depleted batch ${depletedBatch.id}`);
        }
      }
    }
    
    // NOW calculate stock after potential transfers (include both on-shelf and in-storage)
    const stockRows = await query(
      `SELECT COALESCE(SUM(quantity), 0) as totalStock FROM stockbatch 
       WHERE "productId" = $1 AND cabinet = $2 AND status IN ('on-shelf', 'in-storage')`,
      [parseInt(productId), cabinet]
    ) as any[];

    console.log('Stock query result:', stockRows);

    const calculatedStock = (stockRows && stockRows.length > 0) ? parseInt(stockRows[0].totalstock || stockRows[0].totalStock || 0) : 0;
    const currentStock = calculatedStock || parseInt(simpleProduct.stock) || 0;

    console.log('Stock calculation:', { calculatedStock, productStock: simpleProduct.stock, currentStock });
    
    // NOW validate stock (after all transfers)
    if (currentStock < quantity) {
      return NextResponse.json(
        { error: `Insufficient stock for ${simpleProduct.name}. Available: ${currentStock}, Requested: ${quantity}` },
        { status: 400 }
      );
    }

    // Implement proper FIFO stock deduction from existing batches (include both on-shelf and in-storage)
    let availableBatches = await query(
      `SELECT id, quantity FROM stockbatch 
       WHERE "productId" = $1 AND cabinet = $2 AND quantity > 0 AND status IN ('on-shelf', 'in-storage') 
       ORDER BY "batchDate" ASC`,
      [parseInt(productId), cabinet]
    ) as any[];

    console.log('Available batches:', availableBatches);
    console.log('Batch details:');
    availableBatches.forEach((batch, index) => {
      console.log(`  Batch ${index + 1}: ID=${batch.id}, Quantity=${batch.quantity}`);
    });

    // EMERGENCY FIX: If no on-shelf batches with stock, check if we need to transfer from storage
    if (!availableBatches || availableBatches.length === 0) {
      console.log('=== EMERGENCY BATCH TRANSFER ===');
      console.log('No on-shelf batches with stock found, checking for storage batches...');
      
      // Find all batches including storage
      const allBatches = await query(
        'SELECT id, quantity, status, "batchDate" FROM stockbatch WHERE "productId" = $1 AND cabinet = $2 ORDER BY "batchDate" ASC',
        [parseInt(productId), cabinet]
      ) as any[];
      
      console.log('All batches:', allBatches.map(b => ({ id: b.id, quantity: b.quantity, status: b.status })));
      
      // Find depleted on-shelf or in-storage batches
      const depletedOnShelfBatches = allBatches.filter(batch => ['on-shelf', 'in-storage'].includes(batch.status) && Number(batch.quantity) === 0);
      console.log('Depleted on-shelf batches:', depletedOnShelfBatches.length);
      
      if (depletedOnShelfBatches.length > 0) {
        console.log('Found depleted on-shelf batches, transferring...');
        
        for (const depletedBatch of depletedOnShelfBatches) {
          // Find next batch with stock
          const depletedBatchIndex = allBatches.findIndex(batch => batch.id === depletedBatch.id);
          const remainingBatches = allBatches.slice(depletedBatchIndex + 1);
          const nextBatch = remainingBatches.find(batch => Number(batch.quantity) > 0);
          
          if (nextBatch) {
            console.log(`Transferring from batch ${depletedBatch.id} to ${nextBatch.id}`);
            
            // Update depleted batch to 'depleted'
            await query(
              'UPDATE stockbatch SET status = $1, "updatedAt" = NOW() WHERE id = $2',
              ['depleted', depletedBatch.id]
            );
            
            // Promote next batch to the depleted batch's status (on-shelf or in-storage)
            await query(
              'UPDATE stockbatch SET status = $1, "updatedAt" = NOW() WHERE id = $2',
              [depletedBatch.status, nextBatch.id]
            );
            
            console.log(`✅ Emergency transfer complete: ${depletedBatch.id} -> ${nextBatch.id}`);
          }
        }
        
        // Re-fetch available batches after transfer (include both on-shelf and in-storage)
        availableBatches = await query(
          `SELECT id, quantity FROM stockbatch 
           WHERE "productId" = $1 AND cabinet = $2 AND quantity > 0 AND status IN ('on-shelf', 'in-storage') 
           ORDER BY "batchDate" ASC`,
          [parseInt(productId), cabinet]
        ) as any[];
        
        console.log('Available batches after emergency transfer:', availableBatches);
      }
    }

    // If no batches exist, create one from product stock and deduct from it
    if (!availableBatches || availableBatches.length === 0) {
      console.log('No batches found for product', productId, 'in cabinet', cabinet, '- creating stock batch from product stock:', currentStock);
      
      try {
        // Create a stock batch with current product stock
        await query(
          'INSERT INTO stockbatch ("productId", quantity, "batchDate", cabinet, status, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), $3, $4, NOW(), NOW())',
          [parseInt(productId), currentStock, cabinet, 'on-shelf']
        );
        
        console.log('Stock batch created successfully');
        
        // Now fetch the batch we just created
        availableBatches = await query(
          'SELECT id, quantity FROM stockbatch WHERE "productId" = $1 AND cabinet = $2 AND quantity > 0 ORDER BY "batchDate" ASC',
          [parseInt(productId), cabinet]
        ) as any[];
        
        console.log('Fetched new batches:', availableBatches);
      } catch (batchCreateError: any) {
        console.error('Failed to create stock batch:', batchCreateError);
        return NextResponse.json(
          { error: `Failed to create stock batch: ${batchCreateError.message}` },
          { status: 500 }
        );
      }
      
      if (!availableBatches || availableBatches.length === 0) {
        return NextResponse.json(
          { error: `Failed to create stock batch for ${simpleProduct.name} - batch not found after creation` },
          { status: 500 }
        );
      }
    }

    // CONSOLIDATION: If there are multiple small batches, consolidate them
    if (availableBatches.length > 1) {
      console.log(`Found ${availableBatches.length} batches, checking if consolidation is needed`);
      
      // Check if we should consolidate (more than 1 batch with small quantities)
      const totalBatchQuantity = availableBatches.reduce((sum, batch) => sum + batch.quantity, 0);
      
      if (availableBatches.length > 1 && totalBatchQuantity > 0) {
        console.log(`Consolidating ${availableBatches.length} batches into one with total quantity: ${totalBatchQuantity}`);
        
        // Delete all existing batches
        for (const batch of availableBatches) {
          await query('DELETE FROM stockbatch WHERE id = $1', [batch.id]);
        }
        
        // Create one consolidated batch
        await query(
          'INSERT INTO stockbatch ("productId", quantity, "batchDate", cabinet, status, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), $3, $4, NOW(), NOW())',
          [parseInt(productId), totalBatchQuantity, cabinet, 'on-shelf']
        );
        
        // Fetch the new consolidated batch (include both on-shelf and in-storage)
        availableBatches = await query(
          `SELECT id, quantity FROM stockbatch 
           WHERE "productId" = $1 AND cabinet = $2 AND quantity > 0 AND status IN ('on-shelf', 'in-storage') 
           ORDER BY "batchDate" ASC`,
          [parseInt(productId), cabinet]
        ) as any[];
        
        console.log('After consolidation:', availableBatches);
      }
    }

    let remainingQuantity = quantity;
    const batchesUsed: Array<{ id: number; quantity: number }> = [];

    console.log(`Starting FIFO deduction for quantity: ${quantity}`);

    // FIFO deduction from batches
    for (const batch of availableBatches) {
      if (remainingQuantity <= 0) break;
      
      const deductQuantity = Math.min(remainingQuantity, batch.quantity);
      batchesUsed.push({ id: batch.id, quantity: deductQuantity });
      remainingQuantity -= deductQuantity;
      
      console.log(`Batch ${batch.id}: Deducting ${deductQuantity}, remaining: ${remainingQuantity}`);
    }

    if (remainingQuantity > 0) {
      return NextResponse.json(
        { error: `Insufficient stock for ${simpleProduct.name}. Available: ${quantity - remainingQuantity}, Requested: ${quantity}` },
        { status: 400 }
      );
    }

    // Update batches by deducting from them
    console.log('=== BATCH UPDATES ===');
    console.log('Batches to update:', batchesUsed);
    
    for (const usage of batchesUsed) {
      console.log(`Updating batch ${usage.id}: deducting ${usage.quantity}`);
      await query(
        'UPDATE stockbatch SET quantity = quantity - $1, "updatedAt" = NOW() WHERE id = $2',
        [usage.quantity, usage.id]
      );
    }

    // AUTO BATCH TRANSFER: Check if any batch hit 0 and transfer current status to next available
    console.log('=== CHECKING BATCH TRANSFER AFTER DEDUCTION ===');
    
    // Get all batches for this product (including storage) ordered by date
    const allBatchesAfterDeduction = await query(
      'SELECT id, quantity, status, "batchDate" FROM stockbatch WHERE "productId" = $1 AND cabinet = $2 ORDER BY "batchDate" ASC',
      [parseInt(productId), cabinet]
    ) as any[];
    
    console.log('All batches after deduction:', allBatchesAfterDeduction.map(b => ({ id: b.id, quantity: b.quantity, status: b.status })));
    
    // Find ALL batches that are now 0 (regardless of current status - could be 'on-shelf' or 'in-storage')
    const depletedBatchesAfterDeduction = allBatchesAfterDeduction.filter(batch => Number(batch.quantity) === 0 && ['on-shelf', 'in-storage'].includes(batch.status));
    
    console.log('Depleted on-shelf batches found:', depletedBatchesAfterDeduction.length);
    
    if (depletedBatchesAfterDeduction.length > 0) {
      console.log(`Found ${depletedBatchesAfterDeduction.length} depleted batches to transfer`);
      
      for (const depletedBatch of depletedBatchesAfterDeduction) {
        console.log(`Processing depleted batch ${depletedBatch.id}...`);
        
        // Find the next batch with quantity > 0 (could be 'storage' or 'on-shelf')
        const depletedBatchIndex = allBatchesAfterDeduction.findIndex(batch => batch.id === depletedBatch.id);
        const remainingBatches = allBatchesAfterDeduction.slice(depletedBatchIndex + 1);
        
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
          
          // Promote the next batch to the status of the depleted batch (could be 'on-shelf' or 'in-storage')
          console.log(`Updating batch ${nextBatch.id} from '${nextBatch.status}' to '${depletedBatch.status}'`);
          await query(
            'UPDATE stockbatch SET status = $1, "updatedAt" = NOW() WHERE id = $2',
            [depletedBatch.status, nextBatch.id]
          );
          
          console.log(`✅ Batch transfer complete: ${depletedBatch.id} -> ${nextBatch.id}`);
          
          // Update the allBatchesAfterDeduction array to reflect the change
          const updatedNextBatch = allBatchesAfterDeduction.find(batch => batch.id === nextBatch.id);
          if (updatedNextBatch) {
            updatedNextBatch.status = depletedBatch.status;
          }
          const updatedDepletedBatch = allBatchesAfterDeduction.find(batch => batch.id === depletedBatch.id);
          if (updatedDepletedBatch) {
            updatedDepletedBatch.status = 'depleted';
          }
        } else {
          console.log(`❌ No next batch available with stock for depleted batch ${depletedBatch.id}`);
        }
      }
    } else {
      console.log('✅ No depleted batches found');
    }

    // Calculate new stock based on remaining batch quantities (include both on-shelf and in-storage)
    const newTotalStock = await query(
      `SELECT COALESCE(SUM(quantity), 0) as total FROM stockbatch 
       WHERE "productId" = $1 AND cabinet = $2 AND status IN ('on-shelf', 'in-storage')`,
      [parseInt(productId), cabinet]
    ) as any[];

    console.log(`New total stock calculation: ${newTotalStock[0]?.total || 0}`);

    // Update the product's stock to match batch totals
    await query(
      'UPDATE product SET stock = $1, "updatedAt" = NOW() WHERE id = $2',
      [newTotalStock[0]?.total || 0, parseInt(productId)]
    );

    return NextResponse.json({ 
      success: true, 
      message: `Deducted ${quantity} units from product ${simpleProduct.name}`,
      newStock: newTotalStock[0]?.total || 0
    });
    
  } catch (error: any) {
    console.error('=== STOCK DEDUCTION ERROR ===');
    console.error('Full error object:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    
    const errorMessage = error?.message || error?.toString() || '';
    
    // Check for JSON parsing errors
    if (errorMessage.includes('Unexpected token') || errorMessage.includes('JSON')) {
      console.log('JSON parsing error detected');
      return NextResponse.json(
        { error: 'Invalid JSON format in request body' },
        { status: 400 }
      );
    }
    
    // Check for column does not exist error
    if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
      console.log('Database column error detected');
      return NextResponse.json(
        { error: 'Database schema error: ' + errorMessage },
        { status: 500 }
      );
    }
    
    // Check for foreign key constraint violation
    if (errorMessage.includes('foreign key constraint') || errorMessage.includes('1452')) {
      console.log('Foreign key constraint error detected');
      return NextResponse.json(
        { error: 'Invalid Product ID. The specified product does not exist.' },
        { status: 400 }
      );
    }
    
    // Check for database constraint violations
    if (errorMessage.includes('CHECK constraint') || errorMessage.includes('3819')) {
      console.log('Database constraint error detected');
      return NextResponse.json(
        { error: 'Invalid data: Values violate database constraints.' },
        { status: 400 }
      );
    }
    
    // Check for any other database errors
    if (errorMessage.includes('database') || errorMessage.includes('SQL') || errorMessage.includes('query')) {
      console.log('Database error detected:', errorMessage);
      return NextResponse.json(
        { error: 'Database error: ' + errorMessage },
        { status: 500 }
      );
    }
    
    console.log('Unknown error type, returning generic error');
    return NextResponse.json(
      { error: 'Failed to deduct stock', details: error.message },
      { status: 500 }
    );
  }
}
