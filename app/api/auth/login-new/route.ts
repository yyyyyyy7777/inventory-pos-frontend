import { NextRequest, NextResponse } from 'next/server'
import { verifyEmployee, updateLastLogin, refreshEmployees } from '@/lib/pg-direct'
import { query } from '@/lib/pg-direct'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, clientTimestamp } = body
    
    console.log('=== LOGIN API DEBUG ===');
    console.log('Received body:', body);
    console.log('clientTimestamp:', clientTimestamp);

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
    await updateLastLogin(username, clientTimestamp);
    
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
        // Use client timestamp if provided, otherwise calculate from server time
        let timestamp: string;
        if (clientTimestamp) {
          timestamp = clientTimestamp;
        } else {
          const now = new Date();
          timestamp = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}, ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
        }
        
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
    
    // Log login activity with client timestamp
    try {
      // Must use client timestamp - server time is UTC and will be wrong for users
      let timestamp: string;
      if (clientTimestamp) {
        timestamp = clientTimestamp;
      } else {
        // Only fallback to server time if somehow clientTimestamp wasn't sent
        const now = new Date();
        timestamp = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}, ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
        console.warn('WARNING: clientTimestamp not provided, using server time');
      }
      
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
