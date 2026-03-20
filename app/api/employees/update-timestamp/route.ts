import { NextResponse, NextRequest } from 'next/server'
import { query } from '@/lib/pg-direct'

export async function POST(request: NextRequest) {
  try {
    const { username, clientTimestamp, type } = await request.json()
    
    console.log('=== DIRECT TIMESTAMP UPDATE ===');
    console.log('Username:', username);
    console.log('Client timestamp:', clientTimestamp);
    console.log('Type:', type || 'login');
    
    if (!username) {
      return NextResponse.json({ error: 'Missing username' }, { status: 400 })
    }
    
    // Use client timestamp if provided, otherwise generate from current time
    let localTime: string;
    
    if (clientTimestamp) {
      localTime = clientTimestamp;
    } else {
      // Generate from current time (fallback)
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const year = now.getFullYear();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      localTime = `${month}/${day}/${year} ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
    }
    
    // Update the appropriate field
    const field = type === 'logout' ? 'lastLogout' : 'lastLogin';
    
    await query(
      `UPDATE employee SET "${field}" = $1 WHERE username = $2`,
      [localTime, username]
    )
    
    console.log(`✅ Direct ${field} update successful:`, localTime);
    
    // Also log activity if it's a logout (to avoid duplicates)
    if (type === 'logout') {
      try {
        const activityId = Date.now().toString();
        await query(
          `INSERT INTO activities (id, timestamp, username, activity, details, category) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [activityId, clientTimestamp, username, 'User logged out', `User ${username} logged out of the system`, 'employee']
        );
        console.log('✅ Activity logged for logout:', username);
      } catch (activityError) {
        console.error('Failed to log activity:', activityError);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `${field} updated directly`,
      timestamp: clientTimestamp 
    })
    
  } catch (error) {
    console.error('Direct update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
