import { NextResponse } from 'next/server'
import { query } from '@/lib/pg-direct'

export async function POST() {
  try {
    console.log('=== AGGRESSIVE BULK TIMESTAMP FIX FOR ALL USERS ===');
    
    // Get ALL users regardless of their current timestamps
    const users = await query('SELECT username, "lastLogin", "lastLogout" FROM employee');
    
    console.log(`Found ${users.length} users to process:`);
    users.forEach(user => {
      console.log(`  - ${user.username}: lastLogin=${user.lastLogin}, lastLogout=${user.lastLogout}`);
    });
    
    // Clear ALL timestamps for ALL users - no exceptions
    await query('UPDATE employee SET "lastLogin" = NULL, "lastLogout" = NULL');
    
    console.log('✅ Aggressively cleared ALL timestamps for ALL users');
    
    // Verify the clear worked
    const verifyUsers = await query('SELECT username, "lastLogin", "lastLogout" FROM employee');
    console.log('Verification - all users should now have NULL timestamps:');
    verifyUsers.forEach(user => {
      console.log(`  - ${user.username}: lastLogin=${user.lastLogin}, lastLogout=${user.lastLogout}`);
    });
    
    return NextResponse.json({ 
      success: true, 
      message: `Aggressively cleared timestamps for ALL ${users.length} users including admin. Next login will set correct times.` 
    });
    
  } catch (error) {
    console.error('Aggressive bulk fix error:', error);
    return NextResponse.json({ error: 'Aggressive bulk fix failed' }, { status: 500 });
  }
}
