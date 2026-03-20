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

    const rows = await query(
      `SELECT * FROM activities 
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
    const { username, activity, details, category, cabinet, clientTimestamp } = body

    console.log('=== API ACTIVITIES POST ===');
    console.log('Received clientTimestamp:', clientTimestamp);
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
    if (clientTimestamp) {
      timestamp = clientTimestamp;
      console.log('Using client timestamp:', timestamp);
    } else {
      // Fallback: use current local time
      const now = new Date();
      timestamp = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}, ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
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
      { error: 'Failed to create activity' },
      { status: 500 }
    )
  }
}
