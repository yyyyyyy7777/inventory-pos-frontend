import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pg-direct'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { month, cabinet } = body

    console.log('=== ACTIVITIES ARCHIVE STATUS API ===')
    console.log('Request body:', { month, cabinet })

    if (!month) {
      return NextResponse.json(
        { error: 'Missing required field: month' },
        { status: 400 }
      )
    }

    // Parse the month (format: YYYY-MM)
    const [year, monthNum] = month.split('-').map(Number)
    if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM' },
        { status: 400 }
      )
    }

    // Calculate date range for the month
    const startDate = new Date(year, monthNum - 1, 1)
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999) // Last day of month

    console.log('Date range:', { startDate: startDate.toISOString(), endDate: endDate.toISOString() })

    // Ensure archived_activities table exists
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS archived_activities (
          id VARCHAR(50) PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL,
          username VARCHAR(100) NOT NULL,
          activity TEXT NOT NULL,
          details TEXT NOT NULL,
          category VARCHAR(20) NOT NULL CHECK (category IN ('product', 'sale', 'employee', 'system', 'inventory')),
          cabinet VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          original_id VARCHAR(50)
        )
      `);
    } catch (err) {
      console.log('Table creation error (might already exist):', err);
    }

    // Get counts for active and archived activities
    const activeResult = await query(
      `SELECT COUNT(*) as active_count 
       FROM activities 
       WHERE DATE(timestamp) >= $1 
         AND DATE(timestamp) <= $2
         AND id NOT IN (SELECT original_id FROM archived_activities WHERE original_id IS NOT NULL)
         AND ($3::text IS NULL OR cabinet = $3)`,
      [startDate.toISOString(), endDate.toISOString(), cabinet === 'all' ? null : cabinet]
    );

    const archivedResult = await query(
      `SELECT COUNT(*) as archived_count 
       FROM archived_activities 
       WHERE DATE(timestamp) >= $1 
         AND DATE(timestamp) <= $2
         AND original_id IS NOT NULL
         AND ($3::text IS NULL OR cabinet = $3)`,
      [startDate.toISOString(), endDate.toISOString(), cabinet === 'all' ? null : cabinet]
    );

    const activeCount = Array.isArray(activeResult) && activeResult.length > 0 ? activeResult[0].active_count : 0;
    const archivedCount = Array.isArray(archivedResult) && archivedResult.length > 0 ? archivedResult[0].archived_count : 0;

    console.log('Activity counts:', { activeCount, archivedCount })

    return NextResponse.json({
      success: true,
      monthActivities: {
        activeCount,
        archivedCount,
        totalCount: activeCount + archivedCount
      },
      month,
      cabinet
    })

  } catch (error: any) {
    console.error('Activities archive status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get archive status' },
      { status: 500 }
    )
  }
}
