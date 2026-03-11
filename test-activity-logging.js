// Test script to check activity logging
const testActivity = async () => {
  try {
    console.log('Testing activity logging...');
    
    // Test login activity
    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        username: 'admin', 
        password: 'admin123' // Use your actual admin password
      }),
    });
    
    if (loginResponse.ok) {
      console.log('✅ Login activity logged successfully');
      const loginData = await loginResponse.json();
      console.log('Login response:', loginData);
      
      // Test logout activity
      const logoutResponse = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: 'admin' }),
      });
      
      if (logoutResponse.ok) {
        console.log('✅ Logout activity logged successfully');
      } else {
        console.log('❌ Logout activity failed:', logoutResponse.status);
      }
    } else {
      console.log('❌ Login activity failed:', loginResponse.status);
      const errorData = await loginResponse.json();
      console.log('Login error:', errorData);
    }
    
    // Check activities
    const activitiesResponse = await fetch('/api/activities?limit=5');
    if (activitiesResponse.ok) {
      const activities = await activitiesResponse.json();
      console.log('📋 Recent activities:', activities);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Run the test
testActivity();
