/**
 * Example usage of the query cache with Drizzle ORM
 * This file demonstrates how to integrate caching with your existing database queries
 */

import { getDB } from "@/db";
import { userTable, teamTable, creditTransactionTable } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { cachedExecute, invalidateByTag, withCache } from "./query-cache";

/**
 * Example 1: Cache a simple user query
 */
export async function getCachedUser(userId: string) {
  const db = getDB();
  
  return cachedExecute(
    () => db.select().from(userTable).where(eq(userTable.id, userId)).execute(),
    "SELECT * FROM users WHERE id = ?",
    [userId],
    {
      ttl: 300, // Cache for 5 minutes
      tags: [`user:${userId}`, "users"]
    }
  );
}

/**
 * Example 2: Cache team data with longer TTL
 */
export async function getCachedTeam(teamId: string) {
  const db = getDB();
  
  return cachedExecute(
    () => db.select().from(teamTable).where(eq(teamTable.id, teamId)).execute(),
    "SELECT * FROM teams WHERE id = ?",
    [teamId],
    {
      ttl: 1800, // Cache for 30 minutes
      tags: [`team:${teamId}`, "teams"]
    }
  );
}

/**
 * Example 3: Cache aggregated data
 */
export async function getCachedUserCredits(userId: string) {
  const db = getDB();
  
  return cachedExecute(
    async () => {
      const result = await db
        .select()
        .from(creditTransactionTable)
        .where(eq(creditTransactionTable.userId, userId))
        .execute();
      
      const total = result.reduce((sum, credit) => sum + credit.amount, 0);
      return { credits: result, total };
    },
    "SELECT * FROM credits WHERE user_id = ?",
    [userId],
    {
      ttl: 60, // Short cache for financial data
      tags: [`user:${userId}:credits`, "credits"]
    }
  );
}

/**
 * Example 4: Using withCache wrapper for simpler syntax
 */
export async function getCachedRecentUsers() {
  const db = getDB();
  
  const query = db
    .select()
    .from(userTable)
    .orderBy(userTable.createdAt)
    .limit(10);
  
  return withCache(query, {
    ttl: 600, // Cache for 10 minutes
    tags: ["recent-users", "users"]
  });
}

/**
 * Example 5: Invalidate cache when data changes
 */
export async function updateUserAndInvalidateCache(userId: string, data: Partial<typeof userTable.$inferInsert>) {
  const db = getDB();
  
  // Update the user
  await db
    .update(userTable)
    .set(data)
    .where(eq(userTable.id, userId))
    .execute();
  
  // Invalidate all caches related to this user
  await invalidateByTag(`user:${userId}`);
  
  // Also invalidate general user caches
  await invalidateByTag("users");
  await invalidateByTag("recent-users");
}

/**
 * Example 6: Batch query with caching
 */
export async function getCachedUserBatch(userIds: string[]) {
  const db = getDB();
  const sortedIds = [...userIds].sort(); // Sort for consistent cache key
  
  return cachedExecute(
    () => db
      .select()
      .from(userTable)
      .where(inArray(userTable.id, sortedIds))
      .execute(),
    "SELECT * FROM users WHERE id IN (?)",
    sortedIds,
    {
      ttl: 300,
      tags: ["user-batch", ...sortedIds.map(id => `user:${id}`)]
    }
  );
}

/**
 * Example 7: Conditional caching based on query complexity
 */
export async function getSmartCachedData(teamId: string, includeMembers: boolean) {
  const db = getDB();
  
  if (!includeMembers) {
    // Simple query - use cache
    return getCachedTeam(teamId);
  }
  
  // Complex query with joins - use longer cache
  return cachedExecute(
    async () => {
      // Complex query with joins
      const teamData = await db
        .select()
        .from(teamTable)
        .where(eq(teamTable.id, teamId))
        .execute();
      
      // Additional queries for members, etc.
      // ...
      
      return { team: teamData[0], members: [] };
    },
    `SELECT * FROM teams WHERE id = ? WITH members`,
    [teamId],
    {
      ttl: 900, // 15 minutes for complex queries
      tags: [`team:${teamId}:full`, "teams", "team-members"]
    }
  );
}