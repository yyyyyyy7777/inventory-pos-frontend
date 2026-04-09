import { NextResponse } from 'next/server';
import { getAllSales, getSalesByDateRange, createSale } from '@/lib/pg-direct';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cabinet = searchParams.get('cabinet') || undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let sales;
    
    // If date range is provided, use date range query
    if (startDate && endDate) {
      sales = await getSalesByDateRange(
        new Date(startDate), 
        new Date(endDate), 
        cabinet
      );
    } else {
      // Otherwise use the standard getAllSales
      sales = await getAllSales(cabinet || 'main');
    }

    return NextResponse.json(sales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received sale request:', body);
    
    const { date, items, amount, paymentMethod, staffName, cabinet, soldAt, requestKey, referenceNumber, bypassStockCheck, forceCreate, emergencySync } = body;

    // Validate input
    if (!items || items.length === 0) {
      console.log('Validation failed: No items');
      return NextResponse.json(
        { error: 'Sale must have at least one item' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      console.log('Validation failed: Invalid amount', amount);
      return NextResponse.json(
        { error: 'Sale amount must be greater than 0' },
        { status: 400 }
      );
    }

    console.log('Creating sale with data:', {
      amount,
      paymentMethod,
      staffName,
      cabinet,
      soldAt,
      referenceNumber,
      items: items.length
    });

    const sale = await createSale({
      date,
      amount,
      paymentMethod,
      staffName,
      cabinet,
      soldAt,
      requestKey,
      referenceNumber,
      bypassStockCheck,
      forceCreate,
      emergencySync,
      items
    });

    console.log('Sale created successfully:', sale);
    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error('Error creating sale:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Failed to create sale', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
