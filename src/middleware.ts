import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromCookie } from '@/utils/auth'

// Security lockdown configuration
const SECURITY_LOCKDOWN = false // Master switch for security lockdown - DISABLED for production
const ADMIN_ACCESS_TOKEN = process.env.ADMIN_ACCESS_TOKEN // Emergency admin access token - MUST be set in environment

// Routes that are always allowed (even during lockdown)
const ALWAYS_ALLOWED = [
  '/coming-soon',
  '/api/health', // Health check endpoint
]

// Auth routes needed for admin sign-in during lockdown
const AUTH_ROUTES_FOR_ADMIN = [
  '/sign-in',
  '/api/auth',
  '/sso/google',
  '/api/get-session',
]

// Static asset patterns
const STATIC_ASSETS = [
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/.well-known',
]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const url = request.nextUrl
  
  // Generate unique request ID for tracing
  const requestId = crypto.randomUUID()
  request.headers.set('x-request-id', requestId)
  
  // Allow static assets always with aggressive caching
  if (STATIC_ASSETS.some(path => pathname.startsWith(path))) {
    const response = NextResponse.next()
    // Add infinite cache for versioned assets
    if (pathname.includes('_next/static')) {
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      response.headers.set('CDN-Cache-Control', 'max-age=31536000')
    }
    return response
  }
  
  // Security lockdown mode - redirect everything to coming soon except allowed paths
  if (SECURITY_LOCKDOWN) {
    // Check if this path is always allowed
    if (ALWAYS_ALLOWED.includes(pathname)) {
      return NextResponse.next()
    }
    
    // Check for authenticated admin session first
    try {
      const session = await getSessionFromCookie()
      
      if (session && session.user.role === 'admin') {
        // Authenticated admin - allow access to everything
        console.log('[Middleware] Admin user authenticated, allowing access:', pathname)
        return NextResponse.next()
      }
    } catch (error) {
      // Session check failed - continue with other checks
      console.warn('[Middleware] Session check failed:', error)
    }
    
    // Check for emergency admin access token
    const emergencyToken = url.searchParams.get('admin_token')
    const cookieToken = request.cookies.get('admin_token_temp')?.value
    const hasValidToken = (emergencyToken && emergencyToken === ADMIN_ACCESS_TOKEN) || 
                         (cookieToken && cookieToken === ADMIN_ACCESS_TOKEN)
    
    if (hasValidToken) {
      // Allow auth routes for admin sign-in with token
      if (AUTH_ROUTES_FOR_ADMIN.some(route => pathname.startsWith(route))) {
        // Set cookie to maintain token during auth flow
        const response = NextResponse.next()
        if (emergencyToken) {
          response.cookies.set('admin_token_temp', emergencyToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 30, // 30 minutes to complete sign-in
          })
        }
        return response
      }
      
      // If trying to access admin routes with token but no session
      if (pathname.startsWith('/admin')) {
        // Redirect to sign-in with callback URL
        const signInUrl = new URL('/sign-in', request.url)
        signInUrl.searchParams.set('callbackUrl', pathname)
        if (emergencyToken) {
          signInUrl.searchParams.set('admin_token', emergencyToken)
        }
        return NextResponse.redirect(signInUrl)
      }
    }
    
    // Not allowed - redirect to coming soon page
    if (pathname !== '/coming-soon') {
      console.log('[Middleware] Blocking access to:', pathname, '- redirecting to coming soon')
      return NextResponse.redirect(new URL('/coming-soon', request.url))
    }
  }
  
  // Normal operation (when lockdown is disabled)
  
  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/agent-chat', '/settings', '/admin']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  if (isProtectedRoute) {
    try {
      const session = await getSessionFromCookie()
      
      if (!session) {
        const signInUrl = new URL('/sign-in', request.url)
        signInUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(signInUrl)
      }
      
      // Check email verification for all protected routes
      if (!session.user.emailVerified) {
        console.warn(`[Middleware] Unverified user trying to access protected route: ${session.user.email}`)
        // Redirect to a page asking them to verify their email
        return NextResponse.redirect(new URL('/verify-email-required', request.url))
      }
      
      // Additional check for admin routes
      if (pathname.startsWith('/admin') && session.user.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      
      // Additional security for admin: Check IP whitelist (if configured)
      if (pathname.startsWith('/admin')) {
        const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                         request.headers.get('cf-connecting-ip') || 
                         request.headers.get('x-real-ip')
        const allowedIps = process.env.ADMIN_ALLOWED_IPS?.split(',').map(ip => ip.trim()) || []
        
        if (allowedIps.length > 0 && clientIp && !allowedIps.includes(clientIp)) {
          console.warn(`[Middleware] Admin access blocked for IP: ${clientIp}`)
          return NextResponse.redirect(new URL('/403', request.url))
        }
      }
      
    } catch (error) {
      console.error('[Middleware] Protected route auth error:', error)
      return NextResponse.redirect(new URL('/sign-in', request.url))
    }
  }
  
  // Add cache headers for GET requests to API routes
  const response = NextResponse.next()
  
  // Add request ID to response
  response.headers.set('x-request-id', requestId)
  
  // Cache strategy for different route types
  if (request.method === 'GET') {
    if (pathname.startsWith('/api/') && !pathname.includes('/auth')) {
      // API routes - short cache with stale-while-revalidate
      response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=59')
    } else if (pathname.endsWith('.json') || pathname.endsWith('.xml')) {
      // JSON/XML data - moderate cache
      response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    }
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * We want to run middleware on all other routes including API routes
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
}