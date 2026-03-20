import { NextResponse } from 'next/server'
import { query } from '@/lib/pg-direct'

export async function GET() {
  try {
    console.log('=== REAL-TIME TIMESTAMP CHECK ===');
    
    // Get current admin timestamp
    const admin = await query('SELECT username, "lastLogin", "lastLogout" FROM employee WHERE username = $1', ['admin']);
    console.log('Current admin data:', admin);
    
    // Get all users to see the pattern
    const allUsers = await query('SELECT username, "lastLogin", "lastLogout" FROM employee ORDER BY username');
    console.log('All users:');
    allUsers.forEach(user => {
      console.log(`  ${user.username}: login=${user.lastLogin}, logout=${user.lastLogout}`);
    });
    
    return NextResponse.json({
      admin,
      allUsers,
      serverTime: new Date().toString(),
      serverUTCTime: new Date().toUTCString()
    });
    
  } catch (error) {
    console.error('Real-time check error:', error);
    return NextResponse.json({ error: 'Check failed' }, { status: 500 });
  }
}
