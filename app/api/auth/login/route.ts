import { NextRequest, NextResponse } from 'next/server';
import { verifyEmployee, updateLastLogin, refreshEmployees } from '@/lib/pg-direct';
import { query } from '@/lib/pg-direct';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Check employee credentials in database
    const employee = await verifyEmployee(username, password);

    if (!employee) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (employee.status !== 'active') {
      return NextResponse.json(
        { error: 'Account is inactive' },
        { status: 401 }
      );
    }

    console.log('Login successful for user:', username);
    console.log('Employee data:', employee);

    // Update last login time
    console.log('About to call updateLastLogin for:', username);
    const loginResult = await updateLastLogin(username);
    console.log('updateLastLogin result:', loginResult);
    console.log('Last login updated for:', username);
    
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
      
      // Create timestamp in Philippines timezone (Asia/Manila)
      const timestamp = new Date().toLocaleString('en-US', { 
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, '$3-$1-$2T$4:$5:$6.000Z');
      
      await query(
        `INSERT INTO activities (id, timestamp, username, activity, details, category)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [Date.now().toString(), timestamp, username, 'User logged in', `User ${username} (${employee.role}) logged into the system`, 'employee']
      );
      console.log('Login activity logged for:', username);
    } catch (activityError) {
      console.error('Failed to log login activity:', activityError);
      // Don't fail login if activity logging fails
    }
    
    // Refresh employees to update context
    console.log('Calling refreshEmployees...');
    const refreshResult = await refreshEmployees();
    console.log('Refresh result:', refreshResult);

    return NextResponse.json({
      user: {
        id: employee.id,
        name: employee.name,
        username: employee.username,
        role: employee.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
