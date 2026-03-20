import { NextResponse, NextRequest } from 'next/server'
import { query } from '@/lib/pg-direct'

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json()
    
    console.log(`=== TARGETED FIX FOR USER: ${username} ===`);
    
    // Get current state
    const before = await query('SELECT username, "lastLogin", "lastLogout" FROM employee WHERE username = $1', [username]);
    console.log('Before fix:', before);
    
    // Force clear this specific user
    const result = await query(
      'UPDATE employee SET "lastLogin" = NULL, "lastLogout" = NULL WHERE username = $1 RETURNING *',
      [username]
    );
    console.log('Force clear result:', result);
    
    // Verify it worked
    const after = await query('SELECT username, "lastLogin", "lastLogout" FROM employee WHERE username = $1', [username]);
    console.log('After fix:', after);
    
    return NextResponse.json({
      success: true,
      username,
      before,
      after,
      result
    });
    
  } catch (error) {
    console.error('Targeted fix error:', error);
    return NextResponse.json({ error: 'Targeted fix failed' }, { status: 500 });
  }
}
