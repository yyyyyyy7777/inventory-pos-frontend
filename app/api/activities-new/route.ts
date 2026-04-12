import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pg-direct'

// GET /api/activities - Fetch activities
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('=== ACTIVITIES API DEBUG ===');
    console.log('Request URL:', request.url);
    console.log('Limit:', limit);
    console.log('Offset:', offset);

    // Ensure archived_activities table exists
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS archived_activities (
          id VARCHAR(50) PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL,
          username VARCHAR(100) NOT NULL,
          activity TEXT NOT NULL,
          details TEXT NOT NULL,
          category VARCHAR(20) NOT NULL CHECK (category IN ('product', 'sale', 'employee', 'system', 'inventory')),
          cabinet VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          original_id VARCHAR(50)
        )
      `);
    } catch (err) {
      console.log('Table creation error (might already exist):', err);
    }

    const rows = await query(
      `SELECT * FROM activities 
       WHERE id NOT IN (SELECT original_id FROM archived_activities WHERE original_id IS NOT NULL)
       ORDER BY timestamp DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ) as any[]

    console.log('Activities fetched successfully:', rows.length);
    return NextResponse.json(rows)
  } catch (error: any) {
    console.error('Activities fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}

// POST /api/activities - Add new activity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, activity, details, category, cabinet, clientTimestamp, timestamp: bodyTimestamp } = body

    console.log('=== API ACTIVITIES POST ===');
    console.log('Received timestamp:', bodyTimestamp || clientTimestamp);
    console.log('Server time:', new Date().toString());

    if (!username || !activity || !details || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const id = Date.now().toString()
    
    // Use client timestamp if provided, otherwise use current local time
    let timestamp: string;
    if (bodyTimestamp || clientTimestamp) {
      timestamp = bodyTimestamp || clientTimestamp;
      console.log('Using client timestamp:', timestamp);
    } else {
      // Fallback: use current local time
      const now = new Date();
      const hours12 = now.getHours() % 12 || 12;
      timestamp = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}, ${hours12}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
      console.log('Using server timestamp (fallback):', timestamp);
    }

    await query(
      `INSERT INTO activities (id, timestamp, username, activity, details, category, cabinet) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, timestamp, username, activity, details, category, cabinet || null]
    )

    const newActivity = {
      id,
      timestamp,
      username,
      activity,
      details,
      category,
      cabinet: cabinet || null,
      created_at: timestamp
    }

    return NextResponse.json(newActivity, { status: 201 })
  } catch (error: any) {
    console.error('Activity creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create activity', detail: error.stack },
      { status: 500 }
    )
  }
}
