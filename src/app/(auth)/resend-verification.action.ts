"use server";

import { sendVerificationEmail } from "@/utils/email";
import { getDB } from "@/db";
import { userTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getVerificationTokenKey } from "@/utils/auth-utils";
import { EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS } from "@/constants";
import { getSessionFromCookie } from "@/utils/auth";
import { withRateLimit, RATE_LIMITS } from "@/utils/with-rate-limit";
import { ZSAError, createServerAction } from "zsa";
import z from "zod";

// For resending from email-verification-dialog (logged in user)
export const resendVerificationAction = createServerAction()
  .handler(async () => {
    return withRateLimit(
      async () => {
        const session = await getSessionFromCookie();
        if (!session) {
          throw new ZSAError("NOT_AUTHORIZED", "Not authenticated");
        }

        if (session.user.emailVerified) {
          throw new ZSAError("CONFLICT", "Email already verified");
        }

        const { env } = getCloudflareContext();
        if (!env?.NEXT_INC_CACHE_KV) {
          throw new Error("Can't connect to KV store");
        }

        // Generate new verification token
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS * 1000);

        // Store token in KV
        await env.NEXT_INC_CACHE_KV.put(
          getVerificationTokenKey(verificationToken),
          JSON.stringify({
            userId: session.user.id,
            expiresAt: expiresAt.toISOString(),
          }),
          { expirationTtl: EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS }
        );

        // Send verification email
        await sendVerificationEmail({
          email: session.user.email!,
          username: session.user.firstName || session.user.lastName || session.user.email || "User",
          verificationToken,
        });

        return { success: true };
      },
      RATE_LIMITS.EMAIL
    );
  });

// For resending by email (not logged in)
export const resendVerificationByEmailAction = createServerAction()
  .input(z.object({ email: z.string().email() }))
  .handler(async ({ input }) => {
    return withRateLimit(
      async () => {
        const db = getDB();
        
        // Find user by email
        const user = await db.query.userTable.findFirst({
          where: eq(userTable.email, input.email.toLowerCase().trim()),
        });

        if (!user) {
          // Don't reveal if user exists for security
          return {
            success: true,
            message: "If an account exists with this email, a verification link has been sent.",
          };
        }

        if (user.emailVerified) {
          throw new ZSAError("CONFLICT", "This email is already verified.");
        }

        const { env } = getCloudflareContext();
        if (!env?.NEXT_INC_CACHE_KV) {
          throw new Error("Can't connect to KV store");
        }

        // Generate new verification token
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS * 1000);

        // Store token in KV
        await env.NEXT_INC_CACHE_KV.put(
          getVerificationTokenKey(verificationToken),
          JSON.stringify({
            userId: user.id,
            expiresAt: expiresAt.toISOString(),
          }),
          { expirationTtl: EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS }
        );

        // Send verification email
        await sendVerificationEmail({
          email: user.email!,
          username: user.firstName || user.lastName || "User",
          verificationToken,
        });

        return {
          success: true,
          message: "Verification email has been sent. Please check your inbox.",
        };
      },
      RATE_LIMITS.EMAIL
    );
  });