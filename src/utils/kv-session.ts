import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import type { CloudflareEnv } from "@/types/cloudflare";

import { getUserFromDB, getUserTeamsWithPermissions } from "@/utils/auth";
import { getIP } from "./get-IP";
import { MAX_SESSIONS_PER_USER } from "@/constants";
const SESSION_PREFIX = "session:";

export function getSessionKey(userId: string, sessionId: string): string {
  return `${SESSION_PREFIX}${userId}:${sessionId}`;
}

type KVSessionUser = Exclude<Awaited<ReturnType<typeof getUserFromDB>>, undefined>;

export interface KVSession {
  id: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
  user: KVSessionUser & {
    initials?: string;
  };
  country?: string;
  city?: string;
  continent?: string;
  ip?: string | null;
  userAgent?: string | null;
  authenticationType?: "passkey" | "password" | "google-oauth";
  passkeyCredentialId?: string;
  /**
   * Teams data - contains list of teams the user is a member of
   * along with role and permissions data
   */
  teams?: {
    id: string;
    name: string;
    slug: string;
    role: {
      id: string;
      name: string;
      isSystemRole: boolean;
    };
    permissions: string[];
  }[];
  /**
   *  !!!!!!!!!!!!!!!!!!!!!
   *  !!!   IMPORTANT   !!!
   *  !!!!!!!!!!!!!!!!!!!!!
   *
   *  IF YOU MAKE ANY CHANGES TO THIS OBJECT DON'T FORGET TO INCREMENT "CURRENT_SESSION_VERSION" BELOW
   *  IF YOU FORGET, THE SESSION WILL NOT BE UPDATED IN THE DATABASE
   */
  version?: number;
}

/**
 *  !!!!!!!!!!!!!!!!!!!!!
 *  !!!   IMPORTANT   !!!
 *  !!!!!!!!!!!!!!!!!!!!!
 *
 * IF YOU MAKE ANY CHANGES TO THE KVSESSION TYPE ABOVE, YOU NEED TO INCREMENT THIS VERSION.
 * THIS IS HOW WE TRACK WHEN WE NEED TO UPDATE THE SESSIONS IN THE KV STORE.
 */
export const CURRENT_SESSION_VERSION = 2;

export async function getKV() {
  try {
    // Use getCloudflareContext from @opennextjs/cloudflare
    const context = getCloudflareContext();
    
    if (!context || !context.env) {
      console.error('[KV Session] Failed to get Cloudflare context');
      throw new Error("Cloudflare context not available");
    }
    
    const env = context.env as CloudflareEnv;
    
    if (!env.NEXT_INC_CACHE_KV) {
      console.error('[KV Session] KV namespace NEXT_INC_CACHE_KV not found in env', { 
        availableKeys: Object.keys(env)
      });
      throw new Error("KV namespace NEXT_INC_CACHE_KV not available in Cloudflare context");
    }
    
    console.log('[KV Session] Successfully got KV namespace');
    return env.NEXT_INC_CACHE_KV;
  } catch (error) {
    console.error('[KV Session] Error accessing KV store:', error);
    throw new Error("Can't connect to KV store - ensure Cloudflare bindings are properly configured");
  }
}

export interface CreateKVSessionParams extends Omit<KVSession, "id" | "createdAt" | "expiresAt"> {
  sessionId: string;
  expiresAt: Date;
}

export async function createKVSession({
  sessionId,
  userId,
  expiresAt,
  user,
  authenticationType,
  passkeyCredentialId,
  teams
}: CreateKVSessionParams): Promise<KVSession> {
  console.log('[KV Session] Creating session for user:', userId);
  
  let cf;
  try {
    const context = getCloudflareContext();
    cf = context.cf;
  } catch (error) {
    console.warn('[KV Session] Could not get Cloudflare context for geo data:', error);
    // Continue without geo data
  }
  
  const headersList = await headers();
  
  let kv;
  try {
    kv = await getKV();
    console.log('[KV Session] Got KV namespace successfully');
  } catch (error) {
    console.error('[KV Session] Failed to get KV namespace:', error);
    throw new Error(`Failed to get KV store: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (!kv) {
    console.error('[KV Session] KV store is null after getKV() call');
    throw new Error("KV store returned null");
  }

  const session: KVSession = {
    id: sessionId,
    userId,
    expiresAt: expiresAt.getTime(),
    createdAt: Date.now(),
    country: cf?.country,
    city: cf?.city,
    continent: cf?.continent,
    ip: await getIP(),
    userAgent: headersList.get('user-agent'),
    user,
    authenticationType,
    passkeyCredentialId,
    teams,
    version: CURRENT_SESSION_VERSION
  };

  // Check if user has reached the session limit
  const existingSessions = await getAllSessionIdsOfUser(userId);

  // If user has MAX_SESSIONS_PER_USER or more sessions, delete the oldest one
  if (existingSessions.length >= MAX_SESSIONS_PER_USER) {
    // Sort sessions by expiration time (oldest first)
    const sortedSessions = [...existingSessions].sort((a, b) => {
      // If a session has no expiration, treat it as oldest
      if (!a.absoluteExpiration) return -1;
      if (!b.absoluteExpiration) return 1;
      return a.absoluteExpiration.getTime() - b.absoluteExpiration.getTime();
    });

    // Delete the oldest session
    const oldestSessionKey = sortedSessions?.[0]?.key;
    const oldestSessionId = oldestSessionKey?.split(':')?.[2]; // Extract sessionId from key

    await deleteKVSession(oldestSessionId, userId);
  }

  const key = getSessionKey(userId, sessionId);
  const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  
  console.log('[KV Session] Storing session with key:', key, 'TTL:', ttl);
  
  try {
    await kv.put(
      key,
      JSON.stringify(session),
      {
        expirationTtl: ttl
      }
    );
    console.log('[KV Session] Session stored successfully');
  } catch (error) {
    console.error('[KV Session] Failed to store session in KV:', error);
    throw new Error(`Failed to store session: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return session;
}

export async function getKVSession(sessionId: string, userId: string): Promise<KVSession | null> {
  const kv = await getKV();

  if (!kv) {
    throw new Error("Can't connect to KV store");
  }

  const sessionStr = await kv.get(getSessionKey(userId, sessionId));
  if (!sessionStr) return null;

  const session = JSON.parse(sessionStr) as KVSession

  if (session?.user?.createdAt) {
    session.user.createdAt = new Date(session.user.createdAt);
  }

  if (session?.user?.updatedAt) {
    session.user.updatedAt = new Date(session.user.updatedAt);
  }

  if (session?.user?.lastCreditRefreshAt) {
    session.user.lastCreditRefreshAt = new Date(session.user.lastCreditRefreshAt);
  }

  if (session?.user?.emailVerified) {
    session.user.emailVerified = new Date(session.user.emailVerified);
  }

  return session;
}

export async function updateKVSession(sessionId: string, userId: string, expiresAt: Date): Promise<KVSession | null> {
  const session = await getKVSession(sessionId, userId);
  if (!session) return null;

  const updatedUser = await getUserFromDB(userId);

  if (!updatedUser) {
    throw new Error("User not found");
  }

  // Get updated teams data with permissions
  const teamsWithPermissions = await getUserTeamsWithPermissions(userId);

  const updatedSession: KVSession = {
    ...session,
    version: CURRENT_SESSION_VERSION,
    expiresAt: expiresAt.getTime(),
    user: updatedUser,
    teams: teamsWithPermissions
  };

  const kv = await getKV();

  if (!kv) {
    throw new Error("Can't connect to KV store");
  }

  await kv.put(
    getSessionKey(userId, sessionId),
    JSON.stringify(updatedSession),
    {
      expirationTtl: Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    }
  );

  return updatedSession;
}

export async function deleteKVSession(sessionId: string, userId: string): Promise<void> {
  const session = await getKVSession(sessionId, userId);
  if (!session) return;

  const kv = await getKV();

  if (!kv) {
    throw new Error("Can't connect to KV store");
  }

  await kv.delete(getSessionKey(userId, sessionId));
}

export async function getAllSessionIdsOfUser(userId: string) {
  const kv = await getKV();

  if (!kv) {
    throw new Error("Can't connect to KV store");
  }

  const sessions = await kv.list({ prefix: getSessionKey(userId, "") });

  return sessions.keys.map((session: { name: string; expiration?: number }) => ({
    key: session.name,
    absoluteExpiration: session.expiration ? new Date(session.expiration * 1000) : undefined
  }))
}

/**
 * Update all sessions of a user. It can only be called in a server actions and api routes.
 * @param userId
 */
export async function updateAllSessionsOfUser(userId: string) {
  const sessions = await getAllSessionIdsOfUser(userId);
  const kv = await getKV();

  if (!kv) {
    throw new Error("Can't connect to KV store");
  }

  const newUserData = await getUserFromDB(userId);

  if (!newUserData) return;

  // Get updated teams data with permissions
  const teamsWithPermissions = await getUserTeamsWithPermissions(userId);

  for (const sessionObj of sessions) {
    const session = await kv.get(sessionObj.key);
    if (!session) continue;

    const sessionData = JSON.parse(session as string) as KVSession;

    // Only update non-expired sessions
    if (sessionObj.absoluteExpiration && sessionObj.absoluteExpiration.getTime() > Date.now()) {
      const ttlInSeconds = Math.floor((sessionObj.absoluteExpiration.getTime() - Date.now()) / 1000);

      await kv.put(
        sessionObj.key,
        JSON.stringify({
          ...sessionData,
          user: newUserData,
          teams: teamsWithPermissions,
        }),
        { expirationTtl: ttlInSeconds }
      );
    }
  }
}
