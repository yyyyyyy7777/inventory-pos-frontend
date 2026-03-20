import { NextResponse } from 'next/server'
import { query } from '@/lib/pg-direct'

export async function POST() {
  try {
    console.log('=== FORCE CLEAR ADMIN TIMESTAMP ===');
    
    // First check current admin state
    const adminBefore = await query('SELECT username, "lastLogin", "lastLogout" FROM employee WHERE username = $1', ['admin']);
    console.log('Admin before clear:', adminBefore);
    
    // Force clear admin specifically
    const result = await query(
      'UPDATE employee SET "lastLogin" = NULL, "lastLogout" = NULL WHERE username = $1 RETURNING username, "lastLogin", "lastLogout"',
      ['admin']
    );
    
    console.log('Force clear result:', result);
    
    // Verify it worked
    const adminAfter = await query('SELECT username, "lastLogin", "lastLogout" FROM employee WHERE username = $1', ['admin']);
    console.log('Admin after clear:', adminAfter);
    
    // Also clear ALL other users just to be sure
    const clearAll = await query('UPDATE employee SET "lastLogin" = NULL, "lastLogout" = NULL WHERE username != $1', ['admin']);
    console.log('Cleared all other users:', clearAll);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Force cleared admin and all other timestamps',
      adminBefore,
      adminAfter,
      result
    });
    
  } catch (error) {
    console.error('Force clear error:', error);
    return NextResponse.json({ error: 'Force clear failed' }, { status: 500 });
  }
}
