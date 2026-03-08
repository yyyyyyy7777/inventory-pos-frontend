// Simple admin add - paste this in browser console at http://127.0.0.1:57361

// Add admin user directly
fetch('/api/emergency/force-admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}).then(r => r.json()).then(data => {
  console.log('Admin add result:', data);
  if (data.success) {
    alert('✅ Admin added! Now try login with: admin / admin');
    // Test login immediately
    return fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' })
    });
  } else {
    alert('❌ Failed to add admin: ' + data.error);
  }
}).then(loginResponse => {
  if (loginResponse) {
    return loginResponse.json();
  }
}).then(loginData => {
  if (loginData && loginData.user) {
    console.log('✅ Login successful! User:', loginData.user);
    alert('✅ Login works! Admin account is ready.');
  } else if (loginData) {
    console.log('❌ Login failed:', loginData);
    alert('❌ Login still failed: ' + (loginData.error || 'Unknown error'));
  }
}).catch(error => {
  console.error('Error:', error);
  alert('❌ Error: ' + error.message);
});
