import { NextResponse } from 'next/server';
import { query } from '@/lib/pg-direct';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { saleId } = body;

    if (!saleId) {
      return NextResponse.json(
        { error: 'Sale ID is required' },
        { status: 400 }
      );
    }

    console.log('Unarchiving single sale:', saleId);

    // Check if sale exists and is archived
    const checkResult = await query(
      'SELECT id, COALESCE(archived, false) as archived FROM sale WHERE id = $1',
      [saleId]
    );

    if (checkResult.length === 0) {
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      );
    }

    if (!checkResult[0].archived) {
      return NextResponse.json(
        { error: 'Sale is not archived' },
        { status: 400 }
      );
    }

    // Unarchive the sale
    await query(
      'UPDATE sale SET archived = false, "updatedAt" = NOW() WHERE id = $1',
      [saleId]
    );

    console.log('Sale unarchived successfully:', saleId);

    return NextResponse.json({
      success: true,
      message: 'Sale restored successfully',
      saleId
    });
    
  } catch (error: any) {
    console.error('Error unarchiving sale:', error);
    return NextResponse.json(
      { 
        error: 'Failed to unarchive sale',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
