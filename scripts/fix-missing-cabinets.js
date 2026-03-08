const { query } = require('../lib/mysql-direct.ts');

async function fixMissingCabinets() {
  try {
    console.log('Fixing activities with missing cabinets...');
    
    // Update all activities that have null cabinet to 'main'
    const result = await query(
      `UPDATE activities 
       SET cabinet = 'main' 
       WHERE cabinet IS NULL OR cabinet = ''`
    );
    
    console.log(`✅ Updated ${result.affectedRows} activities to have cabinet 'main'`);
    
    // Verify the update
    const verifyResult = await query(
      `SELECT COUNT(*) as count FROM activities WHERE cabinet = 'main'`
    );
    
    console.log(`✅ Total activities with cabinet 'main': ${verifyResult[0].count}`);
    
    // Show some sample activities
    const sampleActivities = await query(
      `SELECT activity, details, cabinet, category FROM activities 
       WHERE cabinet = 'main' AND category = 'employee' 
       ORDER BY timestamp DESC LIMIT 5`
    );
    
    console.log('Sample employee activities with cabinet:');
    sampleActivities.forEach((activity, i) => {
      console.log(`${i+1}. ${activity.activity} - Cabinet: ${activity.cabinet}`);
      console.log(`   Details: ${activity.details}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing cabinets:', error);
  } finally {
    process.exit(0);
  }
}

fixMissingCabinets();
