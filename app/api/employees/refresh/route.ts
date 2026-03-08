import { NextRequest, NextResponse } from 'next/server';
import { refreshEmployees } from '@/lib/pg-direct';

export async function POST(request: NextRequest) {
  try {
    await refreshEmployees();
    
    return NextResponse.json({ 
      success: true,
      message: 'Employee data refreshed successfully'
    });
  } catch (error) {
    console.error('Error refreshing employees:', error);
    return NextResponse.json(
      { error: 'Failed to refresh employees' },
      { status: 500 }
    );
  }
}
