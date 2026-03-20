// Test timezone formatting
const { formatToLocalTime } = require('./lib/datetime-utils.ts');

console.log('=== Timezone Debug Test ===\n');

// Test with current time
const now = new Date();
console.log('Current time test:');
console.log('Raw UTC:', now.toISOString());
console.log('Formatted:', formatToLocalTime(now.toISOString()));
console.log('');

// Test with a specific time that should be 12:23 AM PH time
const testTime = '2024-03-20T16:23:00.000Z'; // 4:23 PM UTC = 12:23 AM PH time next day
console.log('Specific time test (should be 12:23 AM):');
console.log('Raw UTC:', testTime);
console.log('Formatted:', formatToLocalTime(testTime));
console.log('');

// Test what happens when we manually add 8 hours (the bug)
console.log('=== Buggy Behavior (manual +8 hours) ===');
const buggyTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
console.log('Current time +8 hours (buggy):', buggyTime.toISOString());
console.log('This would show wrong time in PH timezone!');
