// Temporary admin dashboard bypass - paste this in console at http://127.0.0.1:57361

// This will temporarily give you admin access without login
localStorage.setItem('isLoggedIn', 'true');
localStorage.setItem('currentUser', JSON.stringify({
  id: 0,
  name: 'Administrator',
  username: 'admin',
  role: 'admin'
}));

// Redirect to admin dashboard
window.location.href = '/admin';

console.log('✅ Temporary admin access granted! Redirecting to admin dashboard...');
console.log('⚠️  Go to Employees section to add admin account with username "admin" password "admin"');
console.log('⚠️  This is temporary - make sure to create proper admin account!');
