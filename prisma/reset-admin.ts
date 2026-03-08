import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
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

  console.log('Admin credentials have been reset:');
  console.log('Username: admin');
  console.log('Password: admin123');
  console.log('\nPlease change this password after logging in!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
