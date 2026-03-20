import { NextResponse } from 'next/server'
import { query } from '@/lib/pg-direct'

export async function POST() {
  try {
    console.log('Clearing all employee timestamps...');
    
    // Clear all lastLogin and lastLogout
    await query('UPDATE employee SET "lastLogin" = NULL, "lastLogout" = NULL');
    
    console.log('✅ All employee timestamps cleared');
    
    return NextResponse.json({ 
      success: true, 
      message: 'All timestamps cleared. Login again to set correct times.' 
    });
    
  } catch (error) {
    console.error('Error clearing timestamps:', error);
    return NextResponse.json(
      { error: 'Failed to clear timestamps' },
      { status: 500 }
    );
  }
}
