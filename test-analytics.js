// Test script for analytics API
// Run this in browser console to test the new analytics endpoints

async function testAnalyticsAPI() {
  console.log('🔍 Testing Analytics API...');
  
  try {
    // Test the analytics endpoint
    const response = await fetch('/api/analytics?cabinet=main&period=weekly');
    const data = await response.json();
    
    console.log('✅ Analytics API Response:', data);
    
    if (data.summary) {
      console.log('📊 Summary Metrics:');
      console.log(`   Total Revenue: ₱${data.summary.totalRevenue.toLocaleString()}`);
      console.log(`   Total Transactions: ${data.summary.totalTransactions}`);
      console.log(`   Total Items: ${data.summary.totalItems}`);
      console.log(`   Revenue Growth: ${data.summary.revenueGrowth}%`);
    }
    
    if (data.topProducts && data.topProducts.length > 0) {
      console.log('🏆 Top Products:');
      data.topProducts.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name}: ₱${product.revenue.toLocaleString()} (${product.quantity} units)`);
      });
    }
    
    if (data.revenueData && data.revenueData.length > 0) {
      console.log('📈 Revenue Data:');
      data.revenueData.forEach(item => {
        console.log(`   ${item.period}: ₱${item.revenue.toLocaleString()}`);
      });
    }
    
    console.log('✅ Analytics API test completed successfully!');
    return data;
    
  } catch (error) {
    console.error('❌ Analytics API test failed:', error);
    return null;
  }
}

// Test different periods
async function testAllPeriods() {
  const periods = ['weekly', 'monthly', 'quarterly', 'yearly'];
  
  for (const period of periods) {
    console.log(`\n📅 Testing ${period} period...`);
    try {
      const response = await fetch(`/api/analytics?cabinet=main&period=${period}`);
      const data = await response.json();
      console.log(`✅ ${period}: ${data.revenueData?.length || 0} data points`);
    } catch (error) {
      console.error(`❌ ${period} failed:`, error);
    }
  }
}

// Export functions to global scope
window.testAnalyticsAPI = testAnalyticsAPI;
window.testAllPeriods = testAllPeriods;

console.log('🎯 Analytics test functions loaded!');
console.log('Run testAnalyticsAPI() to test the main endpoint');
console.log('Run testAllPeriods() to test all time periods');
