import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/pg-direct';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    console.log('DELETE API called with batchId:', batchId);

    if (!batchId) {
      console.log('Batch ID is missing or empty');
      return NextResponse.json(
        { error: 'Batch ID is required' },
        { status: 400 }
      );
    }

    const batchIdNum = parseInt(batchId);
    if (isNaN(batchIdNum) || batchIdNum <= 0) {
      return NextResponse.json(
        { error: 'Batch ID must be a positive integer' },
        { status: 400 }
      );
    }

    // First get the batch details
    const batchResult = await query('SELECT * FROM stockbatch WHERE id = $1', [batchIdNum]) as any[];
    if (!batchResult || batchResult.length === 0) {
      return NextResponse.json(
        { error: 'Stock batch not found' },
        { status: 404 }
      );
    }

    const batch = batchResult[0];

    try {
      // Update product stock (subtract the batch quantity)
      await query(
        'UPDATE product SET stock = stock - $1 WHERE id = $2',
        [batch.quantity, batch.productId]
      );

      // Delete the batch
      await query('DELETE FROM stockbatch WHERE id = $1', [batchIdNum]);

      return NextResponse.json({
        success: true,
        message: 'Stock batch deleted successfully',
        deletedBatch: {
          id: batch.id,
          quantity: batch.quantity,
          productId: batch.productId
        }
      });

    } catch (error) {
      throw error;
    }

  } catch (error) {
    console.error('Error deleting stock batch:', error);
    return NextResponse.json(
      { error: 'Failed to delete stock batch' },
      { status: 500 }
    );
  }
}
