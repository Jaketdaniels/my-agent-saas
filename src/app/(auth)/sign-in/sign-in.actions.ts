"use server";

import { createServerAction, ZSAError } from "zsa";
import { getDB } from "@/db";
import { userTable } from "@/db/schema";
import { signInSchema } from "@/schemas/signin.schema";
import { verifyPassword } from "@/utils/password-hasher";
import { createAndStoreSession } from "@/utils/auth";
import { eq } from "drizzle-orm";
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit";
import { isAccountLocked, recordFailedAttempt, clearLoginAttempts } from "@/utils/login-attempts";

export const signInAction = createServerAction()
  .input(signInSchema)
  .handler(async ({ input }) => {
    return withRateLimit(
      async () => {
        const db = getDB();

        try {
          // Check if account is locked
          const lockStatus = await isAccountLocked(input.email);
          if (lockStatus.locked) {
            throw new ZSAError(
              "FORBIDDEN",
              `Account temporarily locked due to too many failed attempts. Please try again in ${lockStatus.minutesRemaining} minutes.`
            );
          }

          // Find user by email
          const user = await db.query.userTable.findFirst({
            where: eq(userTable.email, input.email),
          });

          if (!user) {
            // Record failed attempt even if user doesn't exist (prevent enumeration)
            await recordFailedAttempt(input.email);
            throw new ZSAError(
              "NOT_AUTHORIZED",
              "Invalid email or password"
            );
          }

          // Check if user has only Google SSO
          if (!user.passwordHash && user.googleAccountId) {
            throw new ZSAError(
              "FORBIDDEN",
              "Please sign in with your Google account instead."
            );
          }

          if (!user.passwordHash) {
            throw new ZSAError(
              "NOT_AUTHORIZED",
              "Invalid email or password"
            );
          }

          // Verify password
          const isValid = await verifyPassword({
            storedHash: user.passwordHash,
            passwordAttempt: input.password
          });

          if (!isValid) {
            // Record failed attempt
            const attemptResult = await recordFailedAttempt(input.email);
            
            if (attemptResult.lockout) {
              throw new ZSAError(
                "FORBIDDEN",
                "Too many failed attempts. Account temporarily locked for 15 minutes."
              );
            }
            
            throw new ZSAError(
              "NOT_AUTHORIZED",
              attemptResult.attemptsRemaining > 0 
                ? `Invalid email or password. ${attemptResult.attemptsRemaining} attempts remaining.`
                : "Invalid email or password"
            );
          }
          
          // Clear login attempts on successful password verification
          await clearLoginAttempts(input.email);

          // Check if email is verified
          if (!user.emailVerified) {
            console.warn('[Sign In] Attempt to login with unverified email:', user.email);
            throw new ZSAError(
              "FORBIDDEN",
              "Please verify your email address before signing in. Check your inbox for the verification email."
            );
          }

          // Create session
          try {
            await createAndStoreSession(user.id, "password")
          } catch (sessionError) {
            console.error('[Sign In] Failed to create session:', sessionError);
            throw new ZSAError(
              "INTERNAL_SERVER_ERROR",
              "Failed to create session. Please try again or contact support if the issue persists."
            );
          }

          return { success: true };
        } catch (error) {
          console.error('[Sign In] Error during sign-in:', error)

          if (error instanceof ZSAError) {
            throw error;
          }

          throw new ZSAError(
            "INTERNAL_SERVER_ERROR",
            "An unexpected error occurred during sign-in"
          );
        }
      },
      RATE_LIMITS.SIGN_IN
    );
  });

