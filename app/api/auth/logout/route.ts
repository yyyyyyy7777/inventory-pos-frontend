import { NextRequest, NextResponse } from 'next/server';
import { updateLastLogout } from '@/lib/pg-direct';
import { query } from '@/lib/pg-direct';

export async function POST(request: NextRequest) {
  // DISABLED - Use logout-new route instead
  return NextResponse.json({ error: 'Logout route disabled. Use /api/auth/logout-new' }, { status: 410 })
}
