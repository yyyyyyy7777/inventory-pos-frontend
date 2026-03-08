import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('GET request for product ID:', params.id);
    
    // Simple test response
    return NextResponse.json({
      id: params.id,
      name: 'Test Product',
      message: 'API route is working'
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}
