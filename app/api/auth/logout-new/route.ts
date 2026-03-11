import { NextRequest, NextResponse } from 'next/server'
import { updateLastLogout } from '@/lib/pg-direct'
import { query } from '@/lib/pg-direct'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username } = body

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    // Update last logout time
    await updateLastLogout(username)

    // Log logout activity with Philippines time
    try {
      const now = new Date()
      const philippinesTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
      const timestamp = philippinesTime.toISOString()
      
      await query(
        `INSERT INTO activities (id, timestamp, username, activity, details, category)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [Date.now().toString(), timestamp, username, 'User logged out', `User ${username} logged out of the system`, 'employee']
      )
    } catch (activityError) {
      console.error('Failed to log logout activity:', activityError)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Logout API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
