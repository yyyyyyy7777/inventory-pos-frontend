import { NextRequest, NextResponse } from 'next/server'
import { createEmployee, query } from '@/lib/pg-direct';

// POST /api/emergency/restore-admin - Restore admin user
export async function POST(request: NextRequest) {
  try {
    console.log('Emergency admin restoration started...');
    
    // Check if admin already exists
    const existingAdmin = await query(
      "SELECT * FROM employee WHERE id = 0 OR username = 'admin'"
    );
    
    if (existingAdmin.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Admin user already exists',
        admin: existingAdmin[0]
      });
    }
    
    // Restore admin user
    await query(`
      INSERT INTO employee (
        id, name, username, password, role, status, "joinDate"
      ) VALUES (
        0, 'Administrator', 'admin', 'admin123', 'admin', 'active', NOW()
      )
    `);
    
    // Verify restoration
    const restoredAdmin = await query(
      'SELECT * FROM employee WHERE id = 0'
    );
    
    console.log('Admin user restored successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Admin user restored successfully',
      admin: restoredAdmin[0]
    });
    
  } catch (error: any) {
    console.error('Error restoring admin:', error);
    return NextResponse.json(
      { error: 'Failed to restore admin', details: error.message },
      { status: 500 }
    );
  }
}
