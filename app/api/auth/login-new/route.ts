import { NextRequest, NextResponse } from 'next/server'
import { verifyEmployee, updateLastLogin, refreshEmployees } from '@/lib/pg-direct'
import { query } from '@/lib/pg-direct'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    const employee = await verifyEmployee(username, password)

    if (!employee) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    if (employee.status !== 'active') {
      return NextResponse.json(
        { error: 'Account is inactive' },
        { status: 401 }
      )
    }

    // Update last login time
    await updateLastLogin(username)
    
    // Check if user was previously logged in without logout (page reload scenario)
    try {
      const lastActivity = await query(
        `SELECT activity, timestamp FROM activities 
         WHERE username = $1 AND (activity = 'User logged in' OR activity = 'User logged out')
         ORDER BY timestamp DESC LIMIT 1`,
        [username]
      ) as any[]
      
      // If last activity was login without logout, log a logout first
      if (lastActivity.length > 0 && lastActivity[0].activity === 'User logged in') {
        const now = new Date()
        const utcTime = now.getTime()
        const philippinesTime = new Date(utcTime + (8 * 60 * 60 * 1000))
        const timestamp = philippinesTime.toISOString()
        
        await query(
          `INSERT INTO activities (id, timestamp, username, activity, details, category)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [Date.now().toString(), timestamp, username, 'User logged out', `User ${username} session ended (page reload)`, 'employee']
        )
        console.log('Logged previous session logout for:', username)
      }
    } catch (checkError) {
      console.error('Error checking previous session:', checkError)
    }
    
    // Log login activity with Philippines time (UTC+8)
    try {
      const now = new Date()
      // Get current UTC time and add 8 hours for Philippines
      const utcTime = now.getTime()
      const philippinesTime = new Date(utcTime + (8 * 60 * 60 * 1000))
      const timestamp = philippinesTime.toISOString()
      
      console.log('Server UTC time:', now.toISOString())
      console.log('Philippines time:', timestamp)
      
      await query(
        `INSERT INTO activities (id, timestamp, username, activity, details, category)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [Date.now().toString(), timestamp, username, 'User logged in', `User ${username} (${employee.role}) logged into the system`, 'employee']
      )
    } catch (activityError) {
      console.error('Failed to log login activity:', activityError)
    }
    
    // Refresh employees
    await refreshEmployees()

    return NextResponse.json({
      user: {
        id: employee.id,
        name: employee.name,
        username: employee.username,
        role: employee.role
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
