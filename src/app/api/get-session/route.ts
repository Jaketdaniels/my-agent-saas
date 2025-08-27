import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { performanceMonitor } from '@/lib/monitoring/performance';

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id');
  
  try {
    const session = await performanceMonitor.measure(
      'auth.getSession',
      async () => getCurrentSession(),
      { requestId }
    );
    
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