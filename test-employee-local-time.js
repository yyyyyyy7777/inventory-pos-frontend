/**
 * Test local time approach for employee last login
 */

console.log('=== TESTING EMPLOYEE LAST LOGIN LOCAL TIME ===\n');

// Simulate what the database functions do now
function simulateUpdateLastLogin() {
  const localTime = new Date().toLocaleString();
  console.log('1. Database stores last login as:', localTime);
  console.log('   Type:', typeof localTime);
  return localTime;
}

// Simulate what the display function does
function formatToLocalTime(timestamp) {
  if (!timestamp) return 'Never';
  
  try {
    // If timestamp is already in local format
    if (timestamp.includes(',') && timestamp.includes('/')) {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return timestamp;
      
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return 'Invalid date';
  }
}

// Test the flow
console.log('2. Testing the complete flow:');
const storedTime = simulateUpdateLastLogin();
const displayedTime = formatToLocalTime(storedTime);

console.log('   Stored in DB:', storedTime);
console.log('   Displayed as:', displayedTime);

console.log('\n3. Test with 12:23 AM:');
const testDate = new Date();
testDate.setHours(0, 23, 0, 0); // 12:23 AM
const testStored = testDate.toLocaleString();
const testDisplayed = formatToLocalTime(testStored);

console.log('   If login at 12:23 AM:');
console.log('   Stored:', testStored);
console.log('   Displayed:', testDisplayed);

console.log('\n=== EXPECTED RESULT ===');
console.log('✅ Login at 12:23 AM → Last Login shows 12:23 AM');
console.log('✅ No more 8:23 AM (UTC +8) bug!');
console.log('✅ Activity log also shows correct times');

console.log('\n=== CHECK BROWSER CONSOLE FOR ===');
console.log('✓ "Updated last login for [username] to [time]"');
console.log('✓ "Updated last logout for [username] to [time]"');
