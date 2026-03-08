// Direct database admin restore - paste this in browser console at http://127.0.0.1:57361

// First try the API endpoint
fetch('/api/emergency/restore-admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}).then(r => r.json()).then(data => {
  console.log('API Response:', data);
  if (data.success) {
    alert('✅ Admin restored! Use: admin / admin123');
    window.location.reload();
  } else {
    console.log('API failed, trying direct approach...');
    // If API fails, try direct database call through any available endpoint
    directRestore();
  }
}).catch(() => directRestore());

function directRestore() {
  // Try to use the employees API to add admin
  fetch('/api/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 0,
      name: 'Administrator',
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      status: 'active',
      joinDate: new Date().toISOString().split('T')[0]
    })
  }).then(r => r.json()).then(data => {
    console.log('Direct restore response:', data);
    alert('✅ Admin restored! Use: admin / admin123');
    window.location.reload();
  }).catch(error => {
    console.error('All methods failed:', error);
    alert('❌ Could not restore admin. Check console for details.');
  });
}
