import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pg-direct'

// GET /api/activities - Fetch activities
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const rows = await query(
      `SELECT * FROM activities 
       ORDER BY timestamp DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ) as any[]

    return NextResponse.json(rows)
  } catch (error: any) {
    console.error('Activities fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}

// POST /api/activities - Add new activity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, activity, details, category, cabinet } = body

    if (!username || !activity || !details || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const id = Date.now().toString()
    
    // Create proper Philippines timestamp (UTC+8)
    const now = new Date()
    const philippinesTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
    const timestamp = philippinesTime.toISOString()

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
