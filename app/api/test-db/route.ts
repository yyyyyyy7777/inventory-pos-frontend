import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pg-direct'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing database connection...')
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL)
    
    // Test basic query
    const result = await query('SELECT NOW() as current_time, version() as db_version')
    console.log('Database query successful:', result)
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      data: result[0],
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Database connection test failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        details: error.toString(),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
