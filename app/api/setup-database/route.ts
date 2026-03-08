import { NextResponse } from 'next/server';
import { query } from '@/lib/pg-direct';
import { setupDatabase } from '@/lib/setup-database';

export async function POST() {
  try {
    await setupDatabase();
    return NextResponse.json({ 
      success: true, 
      message: 'Database setup completed successfully' 
    });
  } catch (error) {
    console.error('Database setup API error:', error);
    return NextResponse.json(
      { 
        error: 'Database setup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
