import { NextResponse } from 'next/server';
import { archiveSales } from '@/lib/pg-direct';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { archiveMonth, cabinet } = body;

    if (!archiveMonth || !cabinet) {
      return NextResponse.json(
        { error: 'Archive month and cabinet are required' },
        { status: 400 }
      );
    }

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(archiveMonth)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM' },
        { status: 400 }
      );
    }

    console.log('Archiving sales for month:', archiveMonth, 'cabinet:', cabinet);
    const result = await archiveSales(archiveMonth, cabinet);
    console.log('Archive result:', result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error archiving sales:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno
    });
    return NextResponse.json(
      { 
        error: 'Failed to archive sales',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
