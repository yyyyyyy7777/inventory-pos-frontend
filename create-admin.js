const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    // Hash the default admin password
    const password = await hash('admin123', 12);
    
    // Create or update admin user
    const admin = await prisma.employee.upsert({
      where: { username: 'admin' },
      update: {
        password: password,
        role: 'admin',
        status: 'active'
      },
      create: {
        name: 'Admin',
        username: 'admin',
        password: password,
        role: 'admin',
        status: 'active'
      },
    });

    console.log('Admin credentials have been created:');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('\nPlease change this password after logging in!');
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
