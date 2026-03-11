import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pg-direct'

// Create table if it doesn't exist
async function ensureActivitiesTable() {
  try {
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
    `)
    
    // Create indexes separately
    try {
      await query(`CREATE INDEX IF NOT EXISTS idx_timestamp ON activities (timestamp)`)
      await query(`CREATE INDEX IF NOT EXISTS idx_category ON activities (category)`)
      await query(`CREATE INDEX IF NOT EXISTS idx_username ON activities (username)`)
      await query(`CREATE INDEX IF NOT EXISTS idx_cabinet ON activities (cabinet)`)
    } catch (indexError) {
      console.warn('Index creation failed (may already exist):', indexError)
    }
    console.log('Activities table ensured')
  } catch (error) {
    console.error('Error ensuring activities table:', error)
  }
}

// GET /api/activities - Fetch activities with optional filters
export async function GET(request: NextRequest) {
  try {
    // Ensure table exists
    await ensureActivitiesTable()
    
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const cabinet = searchParams.get('cabinet')
    const username = searchParams.get('username')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let whereClause = 'WHERE 1=1'
    const params: any[] = []

    if (category && category !== 'all') {
      whereClause += ` AND category = $${params.length + 1}`
      params.push(category)
    }

    if (cabinet && cabinet !== 'all') {
      whereClause += ` AND cabinet = $${params.length + 1}`
      params.push(cabinet)
    }

    if (username) {
      whereClause += ` AND username LIKE $${params.length + 1}`
      params.push(`%${username}%`)
    }

    const rows = await query(
      `SELECT * FROM activities 
       ${whereClause} 
       ORDER BY timestamp DESC 
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
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
    // Ensure table exists
    await ensureActivitiesTable()
    
    const body = await request.json()
    const { username, activity, details, category, cabinet } = body

    if (!username || !activity || !details || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: username, activity, details, category' },
        { status: 400 }
      )
    }

    const id = Date.now().toString()
    // Store timestamp as UTC
    const now = new Date();
    const timestamp = now.toISOString();
    console.log('Current time (UTC):', timestamp);
    console.log('Current time (PH local):', now.toLocaleString("en-US", {timeZone: "Asia/Manila"}));

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
