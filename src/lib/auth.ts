import "server-only";

import { getSessionFromCookie } from "@/utils/auth";
import { ZSAError } from "zsa";
import { redirect } from "next/navigation";
import { ROLES_ENUM } from "@/db/schema";

/**
 * Require authentication for a route or API endpoint.
 * Redirects to sign-in page if not authenticated.
 */
export async function requireAuth() {
  const session = await getSessionFromCookie();
  
  if (!session) {
    redirect('/sign-in');
  }
  
  return session;
}

/**
 * Require authentication and verified email for a route or API endpoint.
 * Redirects to sign-in page if not authenticated or email not verified.
 */
export async function requireVerifiedAuth() {
  const session = await getSessionFromCookie();
  
  if (!session) {
    redirect('/sign-in');
  }
  
  if (!session.user.emailVerified) {
    redirect('/sign-in?error=verify-email');
  }
  
  return session;
}

/**
 * Get current session without requiring authentication.
 * Returns null if not authenticated.
 */
export async function getCurrentSession() {
  return await getSessionFromCookie();
}

/**
 * Require authentication for API routes.
 * Throws ZSAError if not authenticated instead of redirecting.
 */
export async function requireApiAuth() {
  const session = await getSessionFromCookie();
  
  if (!session) {
    throw new ZSAError("NOT_AUTHORIZED", "Not authenticated");
  }
  
  return session;
}

/**
 * Require authentication and verified email for API routes.
 * Throws ZSAError if not authenticated or email not verified instead of redirecting.
 */
export async function requireVerifiedApiAuth() {
  const session = await getSessionFromCookie();
  
  if (!session) {
    throw new ZSAError("NOT_AUTHORIZED", "Not authenticated");
  }
  
  if (!session.user.emailVerified) {
    throw new ZSAError("FORBIDDEN", "Please verify your email first");
  }
  
  return session;
}

/**
 * Require admin role for a route.
 * Redirects to sign-in page if not authenticated, or home page if not admin.
 */
export async function requireAdminAuth() {
  const session = await getSessionFromCookie();
  
  if (!session) {
    redirect('/sign-in');
  }
  
  if (session.user.role !== ROLES_ENUM.ADMIN) {
    redirect('/dashboard');
  }
  
  return session;
}

/**
 * Require admin role for API routes.
 * Throws ZSAError if not authenticated or not admin.
 */
export async function requireAdminApiAuth() {
  const session = await getSessionFromCookie();
  
  if (!session) {
    throw new ZSAError("NOT_AUTHORIZED", "Not authenticated");
  }
  
  if (session.user.role !== ROLES_ENUM.ADMIN) {
    throw new ZSAError("FORBIDDEN", "Admin access required");
  }
  
  return session;
}

/**
 * Check if current user is an admin.
 * Returns true if user is authenticated and has admin role.
 */
export async function isAdmin(): Promise<boolean> {
  const session = await getSessionFromCookie();
  return session?.user.role === ROLES_ENUM.ADMIN;
}