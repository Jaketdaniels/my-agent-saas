import "server-only";

import { getKV } from "@/utils/kv-session";
import crypto from "crypto";

const CACHE_PREFIX = "query:";
const DEFAULT_TTL = 3600; // 1 hour in seconds

export interface QueryCacheOptions {
  ttl?: number;
  prefix?: string;
  tags?: string[];
}

export interface CachedResult<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  tags?: string[];
}

/**
 * Generates a cache key for a database query
 */
export function generateCacheKey(
  sql: string,
  params?: unknown[],
  prefix: string = CACHE_PREFIX
): string {
  const hash = crypto
    .createHash("md5")
    .update(sql)
    .update(JSON.stringify(params || []))
    .digest("hex");
  
  return `${prefix}${hash}`;
}

/**
 * Cache a database query result in KV
 */
export async function cacheQuery<T>(
  key: string,
  data: T,
  options: QueryCacheOptions = {}
): Promise<void> {
  const { ttl = DEFAULT_TTL, tags = [] } = options;
  
  try {
    const kv = await getKV();
    
    const cachedResult: CachedResult<T> = {
      data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + (ttl * 1000),
      tags
    };
    
    await kv.put(key, JSON.stringify(cachedResult), {
      expirationTtl: ttl
    });
    
    // Also store reverse lookups for tags
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      const existingKeys = await kv.get(tagKey);
      const keys = existingKeys ? JSON.parse(existingKeys) : [];
      if (!keys.includes(key)) {
        keys.push(key);
        await kv.put(tagKey, JSON.stringify(keys), {
          expirationTtl: ttl
        });
      }
    }
  } catch (error) {
    console.error("[Query Cache] Failed to cache query:", error);
    // Don't throw - caching failures shouldn't break the app
  }
}

/**
 * Get a cached query result from KV
 */
export async function getCachedQuery<T>(
  key: string
): Promise<T | null> {
  try {
    const kv = await getKV();
    const cached = await kv.get(key);
    
    if (!cached) {
      return null;
    }
    
    const result: CachedResult<T> = JSON.parse(cached);
    
    // Check if cache is still valid
    if (result.expiresAt < Date.now()) {
      await kv.delete(key);
      return null;
    }
    
    return result.data;
  } catch (error) {
    console.error("[Query Cache] Failed to get cached query:", error);
    return null;
  }
}

/**
 * Invalidate cache entries by tag
 */
export async function invalidateByTag(tag: string): Promise<void> {
  try {
    const kv = await getKV();
    const tagKey = `tag:${tag}`;
    const keysStr = await kv.get(tagKey);
    
    if (keysStr) {
      const keys: string[] = JSON.parse(keysStr);
      
      // Delete all cached queries with this tag
      await Promise.all(keys.map(key => kv.delete(key)));
      
      // Delete the tag mapping itself
      await kv.delete(tagKey);
    }
  } catch (error) {
    console.error("[Query Cache] Failed to invalidate tag:", error);
  }
}

/**
 * Execute a database query with caching
 */
export async function cachedExecute<T>(
  queryFn: () => Promise<T>,
  sql: string,
  params?: unknown[],
  options: QueryCacheOptions = {}
): Promise<T> {
  const key = generateCacheKey(sql, params, options.prefix);
  
  // Try to get from cache first
  const cached = await getCachedQuery<T>(key);
  if (cached !== null) {
    console.log("[Query Cache] Cache hit for key:", key);
    return cached;
  }
  
  console.log("[Query Cache] Cache miss for key:", key);
  
  // Execute the query
  const result = await queryFn();
  
  // Cache the result
  await cacheQuery(key, result, options);
  
  return result;
}

/**
 * Wrapper for Drizzle queries with caching
 */
export async function withCache<T>(
  queryBuilder: { execute: () => Promise<T> },
  options: QueryCacheOptions = {}
): Promise<T> {
  // Generate a cache key from the query
  const sql = queryBuilder.toString ? queryBuilder.toString() : JSON.stringify(queryBuilder);
  
  return cachedExecute(
    () => queryBuilder.execute(),
    sql,
    undefined,
    options
  );
}

/**
 * Clear all query cache entries
 */
export async function clearQueryCache(): Promise<void> {
  try {
    const kv = await getKV();
    
    // List all keys with the cache prefix
    const list = await kv.list({ prefix: CACHE_PREFIX });
    
    // Delete all cache entries
    await Promise.all(
      list.keys.map((key: { name: string }) => kv.delete(key.name))
    );
    
    console.log(`[Query Cache] Cleared ${list.keys.length} cache entries`);
  } catch (error) {
    console.error("[Query Cache] Failed to clear cache:", error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalSize: number;
  oldestEntry?: number;
  newestEntry?: number;
}> {
  try {
    const kv = await getKV();
    const list = await kv.list({ prefix: CACHE_PREFIX });
    
    let totalSize = 0;
    let oldest = Infinity;
    let newest = 0;
    
    for (const key of list.keys) {
      const value = await kv.get(key.name);
      if (value) {
        totalSize += value.length;
        const cached: CachedResult<unknown> = JSON.parse(value);
        oldest = Math.min(oldest, cached.cachedAt);
        newest = Math.max(newest, cached.cachedAt);
      }
    }
    
    return {
      totalEntries: list.keys.length,
      totalSize,
      oldestEntry: oldest === Infinity ? undefined : oldest,
      newestEntry: newest === 0 ? undefined : newest
    };
  } catch (error) {
    console.error("[Query Cache] Failed to get stats:", error);
    return {
      totalEntries: 0,
      totalSize: 0
    };
  }
}