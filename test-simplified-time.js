/**
 * Test simplified timestamp approach
 */

console.log('=== TESTING SIMPLIFIED TIMESTAMP APPROACH ===\n');

// Test the new approach - just use local time
console.log('1. Current local time (no timezone conversion):');
const localTime = new Date().toLocaleString();
console.log('   Local timestamp:', localTime);

console.log('\n2. Test formatting function:');
function formatToLocalTime(timestamp) {
  if (!timestamp) return 'Never';
  
  try {
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

console.log('   Input:', localTime);
console.log('   Output:', formatToLocalTime(localTime));

console.log('\n3. What happens when you login at 12:23 AM:');
const testTime = new Date();
testTime.setHours(0, 23, 0, 0); // Set to 12:23 AM
const testTimestamp = testTime.toLocaleString();
console.log('   Stored timestamp:', testTimestamp);
console.log('   Displayed as:', formatToLocalTime(testTimestamp));

console.log('\n=== EXPECTED BEHAVIOR ===');
console.log('✅ Login at 12:23 AM → stores and displays 12:23 AM');
console.log('✅ No timezone conversions → no +8 hour offset');
console.log('✅ Activity log updates immediately');
console.log('✅ Simple and predictable');

console.log('\n=== DEBUGGING STEPS ===');
console.log('1. Check browser console for "Login activity logged" message');
console.log('2. Check for "Activities fetched: X items" message');
console.log('3. Verify timestamp in database matches local time');
console.log('4. Check activity log refreshes after login');
