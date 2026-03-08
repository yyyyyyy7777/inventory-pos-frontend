import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/pg-direct';

export async function GET(request: NextRequest) {
  try {
    // Test if lastLogin column exists
    const result = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'employee' 
      AND column_name = 'lastLogin'
    `);

    return NextResponse.json({
      hasLastLoginColumn: result.length > 0,
      columns: result
    });
  } catch (error) {
    console.error('Error checking database schema:', error);
    return NextResponse.json(
      { error: 'Failed to check database schema' },
      { status: 500 }
    );
  }
}
