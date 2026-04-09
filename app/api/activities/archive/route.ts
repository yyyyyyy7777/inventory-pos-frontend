import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pg-direct'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { archiveMonth, cabinet, action } = body

    console.log('=== ACTIVITIES ARCHIVE API ===')
    console.log('Request body:', { archiveMonth, cabinet, action })

    if (!archiveMonth || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: archiveMonth and action' },
        { status: 400 }
      )
    }

    // Parse the month (format: YYYY-MM)
    const [year, month] = archiveMonth.split('-').map(Number)
    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM' },
        { status: 400 }
      )
    }

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999) // Last day of month

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

    if (action === 'archive') {
      // Get activities to archive
      const activitiesToArchive = await query(
        `SELECT * FROM activities 
         WHERE DATE(timestamp) >= $1 
           AND DATE(timestamp) <= $2
           AND id NOT IN (SELECT original_id FROM archived_activities WHERE original_id IS NOT NULL)
           AND ($3::text IS NULL OR cabinet = $3)`,
        [startDate.toISOString(), endDate.toISOString(), cabinet === 'all' ? null : cabinet]
      );

      if (!Array.isArray(activitiesToArchive) || activitiesToArchive.length === 0) {
        return NextResponse.json({
          success: true,
          archivedCount: 0,
          message: `No activities to archive for ${archiveMonth}`
        });
      }

      // Move activities to archived table using bulk operation
      let archivedCount = 0;
      if (Array.isArray(activitiesToArchive) && activitiesToArchive.length > 0) {
        try {
          // Prepare bulk insert values
          const values = activitiesToArchive.map(activity => [
            `archived_${activity.id}`,
            activity.timestamp,
            activity.username,
            activity.activity,
            activity.details,
            activity.category,
            activity.cabinet,
            activity.created_at,
            activity.id
          ]);

          // Build bulk insert query
          const placeholders = values.map((_, index) => 
            `($${index * 9 + 1}, $${index * 9 + 2}, $${index * 9 + 3}, $${index * 9 + 4}, $${index * 9 + 5}, $${index * 9 + 6}, $${index * 9 + 7}, $${index * 9 + 8}, $${index * 9 + 9})`
          ).join(', ');

          const flatValues = values.flat();

          await query(
            `INSERT INTO archived_activities 
             (id, timestamp, username, activity, details, category, cabinet, created_at, original_id)
             VALUES ${placeholders}
             ON CONFLICT (id) DO UPDATE SET archived_at = CURRENT_TIMESTAMP`,
            flatValues
          );

          archivedCount = activitiesToArchive.length;
        } catch (err) {
          console.error('Bulk archive failed, falling back to individual operations:', err);
          
          // Fallback to individual operations
          for (const activity of activitiesToArchive) {
            try {
              await query(
                `INSERT INTO archived_activities 
                 (id, timestamp, username, activity, details, category, cabinet, created_at, original_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (id) DO UPDATE SET archived_at = CURRENT_TIMESTAMP`,
                [
                  `archived_${activity.id}`,
                  activity.timestamp,
                  activity.username,
                  activity.activity,
                  activity.details,
                  activity.category,
                  activity.cabinet,
                  activity.created_at,
                  activity.id
                ]
              );
              archivedCount++;
            } catch (individualErr) {
              console.error('Failed to archive activity:', activity.id, individualErr);
            }
          }
        }
      }

      console.log('Archived activities:', archivedCount);

      return NextResponse.json({
        success: true,
        archivedCount,
        message: `Successfully archived ${archivedCount} activities for ${archiveMonth}`
      });

    } else if (action === 'unarchive') {
      // Get archived activities to restore
      const archivedActivities = await query(
        `SELECT * FROM archived_activities 
         WHERE DATE(timestamp) >= $1 
           AND DATE(timestamp) <= $2
           AND original_id IS NOT NULL
           AND ($3::text IS NULL OR cabinet = $3)`,
        [startDate.toISOString(), endDate.toISOString(), cabinet === 'all' ? null : cabinet]
      );

      if (!Array.isArray(archivedActivities) || archivedActivities.length === 0) {
        return NextResponse.json({
          success: true,
          unarchivedCount: 0,
          activities: [],
          message: `No archived activities to restore for ${archiveMonth}`
        });
      }

      // Delete from archived table using bulk operation (activities remain in original table)
      let unarchivedCount = 0;
      if (Array.isArray(archivedActivities) && archivedActivities.length > 0) {
        try {
          // Build bulk delete query
          const archivedIds = archivedActivities.map(a => a.id);
          const placeholders = archivedIds.map((_, index) => `$${index + 1}`).join(', ');

          await query(
            `DELETE FROM archived_activities WHERE id IN (${placeholders})`,
            archivedIds
          );

          unarchivedCount = archivedActivities.length;
        } catch (err) {
          console.error('Bulk unarchive failed, falling back to individual operations:', err);
          
          // Fallback to individual operations
          unarchivedCount = 0;
          for (const archived of archivedActivities) {
            try {
              await query(
                `DELETE FROM archived_activities WHERE id = $1`,
                [archived.id]
              );
              unarchivedCount++;
            } catch (individualErr) {
              console.error('Failed to unarchive activity:', archived.id, individualErr);
            }
          }
        }
      }

      // Get the restored activities from original table
      const restoredActivities = await query(
        `SELECT * FROM activities 
         WHERE DATE(timestamp) >= $1 
           AND DATE(timestamp) <= $2
           AND id IN (${archivedActivities.map(a => `'${a.original_id}'`).join(',')})
         ORDER BY timestamp DESC`,
        [startDate.toISOString(), endDate.toISOString()]
      );

      console.log('Unarchived activities:', unarchivedCount);

      return NextResponse.json({
        success: true,
        unarchivedCount,
        activities: Array.isArray(restoredActivities) ? restoredActivities : [],
        message: `Successfully restored ${unarchivedCount} activities for ${archiveMonth}`
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "archive" or "unarchive"' },
        { status: 400 }
      )
    }

  } catch (error: any) {
    console.error('Activities archive error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to archive/unarchive activities' },
      { status: 500 }
    )
  }
}
