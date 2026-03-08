const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.employee.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      name: 'System Administrator',
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      status: 'active',
    },
  });
  console.log('Created admin user:', admin);

  // Create default category
  const category = await prisma.category.upsert({
    where: { name: 'General' },
    update: {},
    create: {
      name: 'General',
    },
  });
  console.log('Created default category:', category);

  // Create sample products
  const products = [
    {
      name: 'Sample Product 1',
      sku: 'SKU001',
      description: 'A sample product for testing',
      price: 99.99,
      stock: 50,
      cabinet: 'main',
      categoryId: category.id,
    },
    {
      name: 'Sample Product 2',
      sku: 'SKU002',
      description: 'Another sample product',
      price: 149.99,
      stock: 25,
      cabinet: 'main',
      categoryId: category.id,
    },
  ];

  for (const productData of products) {
    const existingProduct = await prisma.product.findFirst({
      where: { sku: productData.sku }
    });
    
    let product;
    if (existingProduct) {
      product = await prisma.product.update({
        where: { id: existingProduct.id },
        data: productData,
      });
    } else {
      product = await prisma.product.create({
        data: productData,
      });
    }
    console.log('Created product:', product);

    // Create stock batch for the product
    const existingBatch = await prisma.stockBatch.findFirst({
      where: { 
        productId: product.id,
        cabinet: productData.cabinet 
      }
    });
    
    if (!existingBatch) {
      await prisma.stockBatch.create({
        data: {
          productId: product.id,
          quantity: productData.stock,
          batchDate: new Date(),
          cabinet: productData.cabinet,
          status: 'on-shelf',
        },
      });
    }
  }

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
