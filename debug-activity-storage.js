// Activity Storage Debug Tool
// Run this in browser console to debug activity storage issues

// Check current activity log storage
function checkActivityStorage() {
  console.log('=== Activity Storage Debug ===')
  
  // Check localStorage
  const localActivities = localStorage.getItem('activityLog')
  console.log('localStorage activityLog:', localActivities ? JSON.parse(localActivities).length + ' items' : 'Not found')
  
  // Check sessionStorage
  const sessionActivities = sessionStorage.getItem('activityLog')
  console.log('sessionStorage activityLog:', sessionActivities ? JSON.parse(sessionActivities).length + ' items' : 'Not found')
  
  // Check storage quota
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    navigator.storage.estimate().then(estimate => {
      console.log('Storage usage:', {
        used: Math.round(estimate.usage / 1024 / 1024) + ' MB',
        available: Math.round(estimate.quota / 1024 / 1024) + ' MB',
        percentage: Math.round((estimate.usage / estimate.quota) * 100) + '%'
      })
    })
  }
  
  return {
    localStorage: localActivities ? JSON.parse(localActivities) : [],
    sessionStorage: sessionActivities ? JSON.parse(sessionActivities) : []
  }
}

// Test activity persistence
function testActivityPersistence() {
  console.log('=== Testing Activity Persistence ===')
  
  // Add test activity
  const testActivity = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    username: 'test-user',
    activity: 'Test Activity',
    details: 'This is a test activity to verify persistence',
    category: 'system'
  }
  
  // Get existing activities
  const existing = JSON.parse(localStorage.getItem('activityLog') || '[]')
  const updated = [testActivity, ...existing]
  
  // Save to both storages
  localStorage.setItem('activityLog', JSON.stringify(updated))
  sessionStorage.setItem('activityLog', JSON.stringify(updated))
  
  console.log('Added test activity. Total activities:', updated.length)
  console.log('Test activity ID:', testActivity.id)
  
  // Verify it was saved
  const verify = JSON.parse(localStorage.getItem('activityLog') || '[]')
  const found = verify.find(a => a.id === testActivity.id)
  console.log('Test activity saved successfully:', !!found)
  
  return testActivity.id
}

// Clear test activities
function clearTestActivities(testId) {
  const activities = JSON.parse(localStorage.getItem('activityLog') || '[]')
  const filtered = activities.filter(a => a.id !== testId)
  
  localStorage.setItem('activityLog', JSON.stringify(filtered))
  sessionStorage.setItem('activityLog', JSON.stringify(filtered))
  
  console.log('Cleared test activity. Remaining:', filtered.length)
}

// Export functions to global scope
window.checkActivityStorage = checkActivityStorage
window.testActivityPersistence = testActivityPersistence
window.clearTestActivities = clearTestActivities

console.log('Activity storage debug tools loaded. Use:')
console.log('- checkActivityStorage() to check current storage')
console.log('- testActivityPersistence() to test saving')
console.log('- clearTestActivities(id) to clean up test data')
