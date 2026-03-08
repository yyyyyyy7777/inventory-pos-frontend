import { NextRequest, NextResponse } from 'next/server';
import { verifyEmployee, getAllEmployees, createEmployee, updateEmployee, deleteEmployee, getConnection, query } from '@/lib/pg-direct';
import bcrypt from 'bcryptjs';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
<<<<<<< HEAD
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (hidden)' : 'NOT SET');
    const employees = await getAllEmployees();
    return NextResponse.json(employees);
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch employees', details: error.message },
=======
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    const employees = await getAllEmployees();
    console.log('Employees fetched:', employees.length);
    console.log('First employee lastLogin:', employees[0]?.lastLogin);
    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
>>>>>>> clean-branch
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, username, password, role = 'staff', status = 'active' } = body;

    if (!name || !username || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate input
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check if employee with same name already exists
    const existingByName = await query(
      'SELECT id FROM employee WHERE name = $1',
      [name]
    );

    if (existingByName.length > 0) {
      return NextResponse.json(
        { error: 'Staff with this name already exists' },
        { status: 409 }
      );
    }

    // Check if employee with same username already exists
    const existingByUsername = await query(
      'SELECT id FROM employee WHERE username = $1',
      [username]
    );

    if (existingByUsername.length > 0) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }

    // Create employee
    const employee = await createEmployee({
      name,
      username,
      password,
      role,
      status
    });
    
    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    console.error('Error creating employee:', error);
    
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, password, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Get existing employee
    const existingRows = await query(
      'SELECT * FROM employee WHERE id = $1',
      [parseInt(id)]
    );

    if (existingRows.length === 0) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const existingEmployee = existingRows[0];

    // Prevent changing admin role to non-admin
    if (existingEmployee.role === 'admin' && updates.role && updates.role !== 'admin') {
      return NextResponse.json(
        { error: 'Cannot change admin role for security reasons' },
        { status: 403 }
      );
    }

    // Update employee
    await updateEmployee(parseInt(id), {
      ...updates,
      password: password || undefined
    });

    return NextResponse.json({ message: 'Employee updated successfully' });
  } catch (error: any) {
    console.error('Error updating employee:', error);
    
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Get existing employee
    const employeeRows = await query(
      'SELECT * FROM employee WHERE id = $1',
      [parseInt(id)]
    );

    if (employeeRows.length === 0) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const employee = employeeRows[0];

    // Prevent deletion of admin accounts
    if (employee.role === 'admin') {
      return NextResponse.json(
        { error: 'Cannot delete admin accounts for security reasons' },
        { status: 403 }
      );
    }

    await deleteEmployee(parseInt(id));

    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting employee:', error);
    
    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    );
  }
}
