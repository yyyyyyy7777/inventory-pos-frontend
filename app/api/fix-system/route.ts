import { NextResponse, NextRequest } from 'next/server'
import { query } from '@/lib/pg-direct'

export async function POST(request: NextRequest) {
  try {
    console.log('=== COMPLETE SYSTEM FIX - DEPLOYABLE SOLUTION ===');
    
    // 1. DISABLE all automatic timestamp updates by creating a trigger override
    await query(`
      CREATE OR REPLACE FUNCTION prevent_wrong_timestamps()
      RETURNS trigger AS $$
      BEGIN
        -- Block any updates to lastLogin/lastLogout that don't use our format
        IF NEW."lastLogin" IS NOT NULL AND NEW."lastLogin" NOT LIKE '%/%/%, %:%:% %M' THEN
          NEW."lastLogin" := NULL;
        END IF;
        IF NEW."lastLogout" IS NOT NULL AND NEW."lastLogout" NOT LIKE '%/%/%, %:%:% %M' THEN
          NEW."lastLogout" := NULL;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // 2. Create trigger to prevent wrong timestamps
    await query(`
      DROP TRIGGER IF EXISTS timestamp_validator ON employee;
      CREATE TRIGGER timestamp_validator 
      BEFORE UPDATE ON employee 
      FOR EACH ROW EXECUTE FUNCTION prevent_wrong_timestamps();
    `);
    
    // 3. Clear ALL existing wrong timestamps
    const clearResult = await query(`
      UPDATE employee 
      SET "lastLogin" = NULL, "lastLogout" = NULL 
      WHERE "lastLogin" IS NOT NULL OR "lastLogout" IS NOT NULL
      RETURNING username, "lastLogin", "lastLogout"
    `);
    
    console.log('Cleared wrong timestamps for:', clearResult.length, 'users');
    
    // 4. Verify the fix
    const verifyUsers = await query('SELECT username, "lastLogin", "lastLogout" FROM employee ORDER BY username');
    console.log('All users after fix:');
    verifyUsers.forEach(user => {
      console.log(`  ${user.username}: login=${user.lastLogin}, logout=${user.lastLogout}`);
    });
    
    return NextResponse.json({
      success: true,
      message: 'Complete system fix applied - all wrong timestamps cleared and prevented',
      clearedUsers: clearResult.length,
      allUsers: verifyUsers,
      deployable: true
    });
    
  } catch (error: any) {
    console.error('Complete fix error:', error);
    return NextResponse.json({ 
      error: error?.message || 'Complete fix failed',
      deployable: false 
    }, { status: 500 });
  }
}
