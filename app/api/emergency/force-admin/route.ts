import { NextRequest, NextResponse } from 'next/server'
import { createEmployee, query } from '@/lib/pg-direct';

// POST /api/emergency/force-admin - Force add admin with proper format
export async function POST(request: NextRequest) {
  try {
    console.log('Force adding admin user...');
    
    // Clear any existing admin
    await query("DELETE FROM employee WHERE username = 'admin'");
    
    // Check what format other employees use
    const sampleEmployee = await query('SELECT * FROM employee LIMIT 1') as any[];
    console.log('Sample employee format:', sampleEmployee[0]);
    
    // Add admin with the same format as other employees
    const result = await query(`
      INSERT INTO employee (name, username, password, role, status, "joinDate") 
      VALUES ('Administrator', 'admin', 'admin', 'admin', 'active', NOW())
    `);
    
    console.log('Insert result:', result);
    
    // Verify admin was added
    const admin = await query("SELECT * FROM employee WHERE username = 'admin'") as any[];
    console.log('Admin after insert:', admin);
    
    if (admin.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Admin added successfully',
        admin: admin[0],
        login: 'admin / admin'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Admin was not inserted properly'
      });
    }
    
  } catch (error: any) {
    console.error('Force admin error:', error);
    return NextResponse.json(
      { error: 'Failed to force add admin', details: error.message },
      { status: 500 }
    );
  }
}
