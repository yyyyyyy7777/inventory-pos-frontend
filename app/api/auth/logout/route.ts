import { NextRequest, NextResponse } from 'next/server';
import { updateLastLogout } from '@/lib/pg-direct';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username) {
      console.error('Logout API: No username provided');
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    console.log('Logout API called for user:', username);
    console.log('Current time:', new Date().toISOString());

    // Update last logout time
    const result = await updateLastLogout(username);
    console.log('updateLastLogout result:', result);
    console.log('Last logout updated for:', username);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
