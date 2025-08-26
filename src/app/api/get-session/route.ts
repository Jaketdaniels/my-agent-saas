import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';

export const runtime = 'edge';

export async function GET() {
  try {
    const session = await getCurrentSession();
    
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
      }
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}