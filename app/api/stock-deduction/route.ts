import { NextResponse } from 'next/server';
import { query } from '@/lib/pg-direct';

// GET handler for testing
export async function GET(request: Request) {
  return NextResponse.json({ status: 'Stock deduction API is working' });
}

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
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
    
    const { productId, quantity, cabinet } = body;
    
    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
    }
    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    }
    if (!cabinet) {
      return NextResponse.json({ error: 'Missing cabinet' }, { status: 400 });
    }

    console.log('Stock deduction request:', { productId, quantity, cabinet });

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

    // Now get the calculated stock from batches
    const stockRows = await query(
      'SELECT COALESCE(SUM(quantity), 0) as totalStock FROM stockbatch WHERE "productId" = $1 AND cabinet = $2',
      [parseInt(productId), cabinet]
    ) as any[];

    console.log('Stock query result:', stockRows);

    const calculatedStock = (stockRows && stockRows.length > 0) ? parseInt(stockRows[0].totalStock) : 0;
    const currentStock = calculatedStock || parseInt(simpleProduct.stock) || 0;

    console.log('Stock calculation:', { calculatedStock, productStock: simpleProduct.stock, currentStock });
    
    if (currentStock < quantity) {
      return NextResponse.json(
        { error: `Insufficient stock for ${simpleProduct.name}. Available: ${currentStock}, Requested: ${quantity}` },
        { status: 400 }
      );
    }

    // Implement proper FIFO stock deduction from existing batches
    let availableBatches = await query(
      'SELECT id, quantity FROM stockbatch WHERE "productId" = $1 AND cabinet = $2 AND quantity > 0 ORDER BY "batchDate" ASC',
      [parseInt(productId), cabinet]
    ) as any[];

    console.log('Available batches:', availableBatches);

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

    let remainingQuantity = quantity;
    const batchesUsed: Array<{ id: number; quantity: number }> = [];

    // FIFO deduction from batches
    for (const batch of availableBatches) {
      if (remainingQuantity <= 0) break;
      
      const deductQuantity = Math.min(remainingQuantity, batch.quantity);
      batchesUsed.push({ id: batch.id, quantity: deductQuantity });
      remainingQuantity -= deductQuantity;
    }

    if (remainingQuantity > 0) {
      return NextResponse.json(
        { error: `Insufficient stock for ${simpleProduct.name}. Available: ${quantity - remainingQuantity}, Requested: ${quantity}` },
        { status: 400 }
      );
    }

    // Update batches by deducting from them
    for (const usage of batchesUsed) {
      await query(
        'UPDATE stockbatch SET quantity = quantity - $1, "updatedAt" = NOW() WHERE id = $2',
        [usage.quantity, usage.id]
      );
    }

    // Update the product's stock
    await query(
      'UPDATE product SET stock = stock - $1, "updatedAt" = NOW() WHERE id = $2',
      [quantity, parseInt(productId)]
    );

    return NextResponse.json({ 
      success: true, 
      message: `Deducted ${quantity} units from product ${simpleProduct.name}`,
      newStock: currentStock - quantity
    });
    
  } catch (error: any) {
    console.error('Error deducting stock:', error);
    const errorMessage = error?.message || error?.toString() || '';
    
    // Check for JSON parsing errors
    if (errorMessage.includes('Unexpected token') || errorMessage.includes('JSON')) {
      return NextResponse.json(
        { error: 'Invalid JSON format in request body' },
        { status: 400 }
      );
    }
    
    // Check for column does not exist error
    if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Database schema error: ' + errorMessage },
        { status: 500 }
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
        { error: 'Invalid data: Values violate database constraints.' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to deduct stock', details: error.message },
      { status: 500 }
    );
  }
}
