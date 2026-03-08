import { NextRequest, NextResponse } from 'next/server';
import { createEmployee } from '@/lib/pg-direct';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  try {
    // Initialize PrismaClient with explicit database URL
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: "mysql://root:@127.0.0.1:3306/inventory_pos"
        }
      }
    });

    // Hash the default admin password
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    // Create or update admin user
    const admin = await prisma.employee.upsert({
      where: { username: 'admin' },
      update: {
        password: hashedPassword,
        role: 'admin',
        status: 'active'
      },
      create: {
        name: 'Admin',
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
        status: 'active',
        joinDate: new Date(),
      },
    });

    await prisma.$disconnect();

    return NextResponse.json({
      message: 'Admin user created successfully',
      credentials: {
        username: 'admin',
        password: 'admin123'
      }
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    return NextResponse.json(
      { error: 'Failed to create admin user' },
      { status: 500 }
    );
  }
}
