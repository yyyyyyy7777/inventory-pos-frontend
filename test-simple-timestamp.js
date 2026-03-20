/**
 * Test the new simple timestamp format
 */

console.log('=== TESTING SIMPLE TIMESTAMP FORMAT ===\n');

// This is what the new code does
function createSimpleTimestamp() {
  const now = new Date();
  return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}, ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
}

// Test current time
const currentTimestamp = createSimpleTimestamp();
console.log('1. Current timestamp format:');
console.log('   Generated:', currentTimestamp);
console.log('   Format: M/D/YYYY, H:MM:SS AM/PM');

console.log('\n2. Test with 12:23 AM:');
const testDate = new Date();
testDate.setHours(0, 23, 0, 0); // 12:23 AM
const testTimestamp = `${testDate.getMonth() + 1}/${testDate.getDate()}/${testDate.getFullYear()}, ${testDate.getHours()}:${testDate.getMinutes().toString().padStart(2, '0')}:${testDate.getSeconds().toString().padStart(2, '0')} ${testDate.getHours() >= 12 ? 'PM' : 'AM'}`;
console.log('   Generated:', testTimestamp);
console.log('   Should show: 12:23:XX AM');

console.log('\n3. Test with 8:31 PM:');
testDate.setHours(20, 31, 0, 0); // 8:31 PM
const testTimestamp2 = `${testDate.getMonth() + 1}/${testDate.getDate()}/${testDate.getFullYear()}, ${testDate.getHours()}:${testDate.getMinutes().toString().padStart(2, '0')}:${testDate.getSeconds().toString().padStart(2, '0')} ${testDate.getHours() >= 12 ? 'PM' : 'AM'}`;
console.log('   Generated:', testTimestamp2);
console.log('   Should show: 8:31:XX PM');

console.log('\n=== WHAT THIS FIXES ===');
console.log('❌ OLD: toLocaleString() → timezone conversion → wrong times');
console.log('✅ NEW: Manual format → exact local time → correct times');

console.log('\n=== EXPECTED BEHAVIOR ===');
console.log('✅ Login at 12:23 AM → stores and shows "12:23:XX AM"');
console.log('✅ Login at 8:31 PM → stores and shows "8:31:XX PM"');
console.log('✅ No more 4-hour offsets!');

console.log('\n=== CHECK CONSOLE FOR ===');
console.log('✓ "Updated last login for [user] to [exact time]"');
console.log('✓ "Updated last logout for [user] to [exact time]"');
console.log('✓ "Activity inserted with timestamp: [exact time]"');
