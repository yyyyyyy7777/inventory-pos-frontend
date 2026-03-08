import { NextRequest, NextResponse } from 'next/server';
import { addStockAddition, getStockAdditions, query } from '@/lib/pg-direct';
import { validateStockBatch } from '@/utils/validation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const cabinet = searchParams.get('cabinet') || 'main';

    // Validate productId parameter
    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
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
