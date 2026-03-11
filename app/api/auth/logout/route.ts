import { NextRequest, NextResponse } from 'next/server';
import { updateLastLogout } from '@/lib/pg-direct';
import { query } from '@/lib/pg-direct';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username) {
      console.error('Logout API: No username provided');
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    console.log('Logout API called for user:', username);
    console.log('Current time:', new Date().toISOString());

    // Update last logout time
    const result = await updateLastLogout(username);
    console.log('updateLastLogout result:', result);
    console.log('Last logout updated for:', username);

    // Log activity directly to database
    try {
      // Ensure activities table exists first
      await query(`
        CREATE TABLE IF NOT EXISTS activities (
          id VARCHAR(50) PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL,
          username VARCHAR(100) NOT NULL,
          activity TEXT NOT NULL,
          details TEXT NOT NULL,
          category VARCHAR(20) NOT NULL CHECK (category IN ('product', 'sale', 'employee', 'system', 'inventory')),
          cabinet VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await query(
        `INSERT INTO activities (id, timestamp, username, activity, details, category)
         VALUES (gen_random_uuid(), NOW(), $1, $2, $3, $4)`,
        [username, 'User logged out', `User ${username} logged out of the system`, 'employee']
      );
      console.log('Logout activity logged for:', username);
    } catch (activityError) {
      console.error('Failed to log logout activity:', activityError);
      // Don't fail logout if activity logging fails
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
