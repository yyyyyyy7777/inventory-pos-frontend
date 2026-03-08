import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pg-direct'

// POST /api/activities/fix-cabinets - Fix activities with missing cabinets
export async function POST(request: NextRequest) {
  try {
    console.log('Fixing activities with missing cabinets...');
    
    // Update all activities that have null cabinet to 'main'
    const result = await query(
      `UPDATE activities 
       SET cabinet = 'main' 
       WHERE cabinet IS NULL OR cabinet = '' RETURNING *`
    );
    
    console.log(`Updated ${result.length} activities to have cabinet 'main'`);
    
    // Verify the update
    const verifyResult = await query(
      `SELECT COUNT(*) as count FROM activities WHERE cabinet = 'main'`
    );
    
    // Get sample activities to show what was fixed
    const sampleActivities = await query(
      `SELECT activity, details, cabinet, category, timestamp FROM activities 
       WHERE cabinet = 'main' AND category = 'employee' 
       ORDER BY timestamp DESC LIMIT 10`
    );
    
    return NextResponse.json({
      success: true,
      updatedCount: result.length,
      totalMainCabinet: verifyResult[0].count,
      sampleActivities: sampleActivities
    });
    
  } catch (error: any) {
    console.error('Error fixing cabinets:', error);
    return NextResponse.json(
      { error: 'Failed to fix cabinets', details: error.message },
      { status: 500 }
    );
  }
}
