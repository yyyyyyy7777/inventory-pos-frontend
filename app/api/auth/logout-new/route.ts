import { NextRequest, NextResponse } from 'next/server'
import { updateLastLogout } from '@/lib/pg-direct'
import { query } from '@/lib/pg-direct'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, clientTimestamp } = body

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    // Update last logout time
    await updateLastLogout(username, clientTimestamp)

    // Log logout activity with client timestamp
    try {
      // Must use client timestamp - server time is UTC and will be wrong for users
      let timestamp: string;
      if (clientTimestamp) {
        timestamp = clientTimestamp;
      } else {
        // Only fallback to server time if somehow clientTimestamp wasn't sent
        const now = new Date();
        const hours12 = now.getHours() % 12 || 12;
        timestamp = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}, ${hours12}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
        console.warn('WARNING: clientTimestamp not provided, using server time');
      }
      
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
