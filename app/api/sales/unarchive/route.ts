import { NextResponse } from 'next/server';
import { unarchiveSales } from '@/lib/pg-direct';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { unarchiveMonth, cabinet } = body;

    if (!unarchiveMonth || !cabinet) {
      return NextResponse.json(
        { error: 'Unarchive month and cabinet are required' },
        { status: 400 }
      );
    }

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(unarchiveMonth)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM' },
        { status: 400 }
      );
    }

    console.log('Unarchiving sales for month:', unarchiveMonth, 'cabinet:', cabinet);
    const result = await unarchiveSales(unarchiveMonth, cabinet);
    console.log('Unarchive result:', result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error unarchiving sales:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno
    });
    return NextResponse.json(
      { 
        error: 'Failed to unarchive sales',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
