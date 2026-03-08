// Activity Backup and Recovery Tool
// Save this file and run in browser console if activities are lost

// Backup current activities
function backupActivities() {
  const activities = JSON.parse(localStorage.getItem('activityLog') || '[]');
  const backup = {
    timestamp: new Date().toISOString(),
    count: activities.length,
    activities: activities
  };
  
  // Download as JSON file
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `activity-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log(`Backed up ${activities.length} activities`);
}

// Restore activities from backup
function restoreActivities(backupData) {
  if (typeof backupData === 'string') {
    backupData = JSON.parse(backupData);
  }
  
  if (backupData.activities && Array.isArray(backupData.activities)) {
    localStorage.setItem('activityLog', JSON.stringify(backupData.activities));
    sessionStorage.setItem('activityLog', JSON.stringify(backupData.activities));
    console.log(`Restored ${backupData.activities.length} activities`);
    console.log('Refresh the page to see them');
    return true;
  } else {
    console.error('Invalid backup data');
    return false;
  }
}

// Check current status
function checkActivityStatus() {
  const local = JSON.parse(localStorage.getItem('activityLog') || '[]');
  const session = JSON.parse(sessionStorage.getItem('activityLog') || '[]');
  
  console.log('=== Activity Status ===');
  console.log('localStorage:', local.length, 'activities');
  console.log('sessionStorage:', session.length, 'activities');
  console.log('Latest activity:', local[0]?.timestamp || 'None');
  
  if (local.length > 0) {
    console.log('Sample activities:');
    local.slice(0, 3).forEach((activity, i) => {
      console.log(`${i+1}. ${activity.activity} by ${activity.username} (${activity.category})`);
    });
  }
}

// Export to global scope
window.backupActivities = backupActivities;
window.restoreActivities = restoreActivities;
window.checkActivityStatus = checkActivityStatus;

console.log('Activity recovery tools loaded!');
console.log('Use: backupActivities(), restoreActivities(data), checkActivityStatus()');
