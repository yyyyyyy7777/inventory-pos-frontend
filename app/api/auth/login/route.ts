import { NextRequest, NextResponse } from 'next/server';
import { verifyEmployee, updateLastLogin, refreshEmployees } from '@/lib/pg-direct';
import { query } from '@/lib/pg-direct';

export async function POST(request: NextRequest) {
  // DISABLED - Use login-new route instead
  return NextResponse.json({ error: 'Login route disabled. Use /api/auth/login-new' }, { status: 410 })
}
