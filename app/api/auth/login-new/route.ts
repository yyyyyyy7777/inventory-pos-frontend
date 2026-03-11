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
    
    // Log login activity with Philippines time
    try {
      const now = new Date()
      const philippinesTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
      const timestamp = philippinesTime.toISOString()
      
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
