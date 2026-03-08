import { NextRequest, NextResponse } from 'next/server'
import { createEmployee, query } from '@/lib/pg-direct';

// POST /api/emergency/add-admin-direct - Direct admin insertion
export async function POST(request: NextRequest) {
  try {
    // First delete any existing admin to avoid conflicts
    await query("DELETE FROM employee WHERE username = 'admin' OR id = 0");
    
    // Insert admin user with exact credentials
    await query(`
      INSERT INTO employee (
        id, name, username, password, role, status, "joinDate"
      ) VALUES (
        0, 'Administrator', 'admin', 'admin', 'admin', 'active', NOW()
      )
    `);
    
    // Verify it was added
    const admin = await query("SELECT * FROM employee WHERE username = 'admin'") as any[];
    
    return NextResponse.json({
      success: true,
      message: 'Admin user added successfully',
      admin: admin[0],
      login: {
        username: 'admin',
        password: 'admin'
      }
    });
    
  } catch (error: any) {
    console.error('Error adding admin:', error);
    return NextResponse.json(
      { error: 'Failed to add admin', details: error.message },
      { status: 500 }
    );
  }
}
