/**
 * Debug test to find timezone issues
 */

console.log('=== TIMEZONE DEBUG TEST ===\n');

// Test what the client is generating
function generateClientTimestamp() {
  const now = new Date();
  const timestamp = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}, ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
  
  console.log('Client-side timestamp generation:');
  console.log('  new Date():', now.toString());
  console.log('  getHours():', now.getHours());
  console.log('  Generated timestamp:', timestamp);
  
  return timestamp;
}

// Test what the server might be doing
function simulateServerTime() {
  console.log('\nServer-side simulation:');
  const serverNow = new Date();
  console.log('  Server new Date():', serverNow.toString());
  console.log('  Server getUTCHours():', serverNow.getUTCHours());
  console.log('  Server getHours():', serverNow.getHours());
  
  // This is what our fallback does
  const philippinesTime = new Date();
  philippinesTime.setHours(philippinesTime.getUTCHours() + 8);
  const serverTimestamp = `${philippinesTime.getMonth() + 1}/${philippinesTime.getDate()}/${philippinesTime.getFullYear()}, ${philippinesTime.getHours()}:${philippinesTime.getMinutes().toString().padStart(2, '0')}:${philippinesTime.getSeconds().toString().padStart(2, '0')} ${philippinesTime.getHours() >= 12 ? 'PM' : 'AM'}`;
  
  console.log('  Server fallback timestamp:', serverTimestamp);
}

// Test current situation
const clientTime = generateClientTimestamp();
simulateServerTime();

console.log('\n=== WHAT TO CHECK IN CONSOLE ===');
console.log('1. "LOGIN PAGE DEBUG" - should show client timestamp being sent');
console.log('2. "UPDATE LAST LOGIN DEBUG" - should show what server receives and stores');
console.log('3. "EMPLOYEE TAB DEBUG" - should show what database returns');

console.log('\n=== IF DEPLOYMENT WILL BE SAME ===');
console.log('✅ YES - if server timezone is different, it will be worse');
console.log('✅ The server fallback (UTC+8) might not match your actual timezone');
console.log('✅ Need to ensure client timestamps are always used');

console.log('\n=== SOLUTION ===');
console.log('1. Always send client timestamp (done)');
console.log('2. Never use server fallback (remove fallback)');
console.log('3. Debug logs will show where the problem is');
