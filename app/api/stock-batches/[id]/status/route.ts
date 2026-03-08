import { NextRequest, NextResponse } from 'next/server';
import { updateBatchStatus } from '@/lib/pg-direct';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const body = await request.json();
    const { status } = body;

    if (!batchId) {
      return NextResponse.json(
        { error: 'Batch ID is required' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    const result = await updateBatchStatus(batchId, status);

    return NextResponse.json({
      message: `Batch status updated to ${status}`,
      ...result
    });

  } catch (error: any) {
    console.error('Error updating batch status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update batch status' },
      { status: 500 }
    );
  }
}
