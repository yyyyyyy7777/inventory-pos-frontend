import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for stock additions (for demo purposes)
// In production, this would be in a database table
let stockAdditions: any[] = [];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const cabinet = searchParams.get('cabinet') || 'main';

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Get stock additions for this product
    const additions = stockAdditions.filter(
      (addition) => addition.productId === productId && addition.cabinet === cabinet
    );

    // Sort by date (newest first)
    additions.sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime());

    return NextResponse.json(additions);
  } catch (error) {
    console.error('Error fetching stock tracking:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock tracking' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, quantity, cabinet, notes, costPerUnit } = body;

    // Validate required fields
    if (!productId || quantity === undefined || quantity <= 0) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, quantity (must be > 0)' },
        { status: 400 }
      );
    }

    // Create new stock addition
    const addition = {
      id: Date.now().toString(), // Simple ID for demo
      productId,
      quantity: parseInt(quantity),
      costPerUnit: costPerUnit ? parseFloat(costPerUnit) : null,
      addedDate: new Date().toISOString(),
      cabinet: cabinet || 'main',
      notes: notes || null,
    };

    // Add to storage
    stockAdditions.push(addition);

    return NextResponse.json(addition, { status: 201 });
  } catch (error) {
    console.error('Error adding stock tracking:', error);
    return NextResponse.json(
      { error: 'Failed to add stock tracking' },
      { status: 500 }
    );
  }
}
