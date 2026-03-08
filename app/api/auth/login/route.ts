import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import { verifyEmployee } from '@/lib/pg-direct';
=======
import { verifyEmployee, updateLastLogin, refreshEmployees } from '@/lib/pg-direct';
>>>>>>> clean-branch

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

<<<<<<< HEAD
    if (employee.status !== 'active') {
      return NextResponse.json(
        { error: 'Account is inactive' },
        { status: 401 }
      );
    }
=======
    console.log('Login successful for user:', username);
    console.log('Employee data:', employee);

    // Update last login time
    console.log('About to call updateLastLogin for:', username);
    const loginResult = await updateLastLogin(username);
    console.log('updateLastLogin result:', loginResult);
    console.log('Last login updated for:', username);
    
    // Refresh employees to update context
    console.log('Calling refreshEmployees...');
    const refreshResult = await refreshEmployees();
    console.log('Refresh result:', refreshResult);
>>>>>>> clean-branch

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
