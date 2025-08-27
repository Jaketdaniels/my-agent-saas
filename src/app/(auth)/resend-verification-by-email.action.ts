"use server";

import { createServerAction, ZSAError } from "zsa";
import { getDB } from "@/db";
import { userTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getVerificationTokenKey } from "@/utils/auth-utils";
import { sendVerificationEmail } from "@/utils/email";
import { withRateLimit, RATE_LIMITS } from "@/utils/with-rate-limit";
import { EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS } from "@/constants";
import { z } from "zod";

const resendVerificationSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resendVerificationByEmailAction = createServerAction()
  .input(resendVerificationSchema)
  .handler(async ({ input }) => {
    return withRateLimit(
      async () => {
        const db = getDB();

        // Find user by email
        const user = await db.query.userTable.findFirst({
          where: eq(userTable.email, input.email),
        });

        if (!user) {
          // Don't reveal whether the email exists in the system
          // Just show success to prevent email enumeration
          return { success: true };
        }

        if (user.emailVerified) {
          // Email is already verified, but don't reveal this
          // to prevent email enumeration
          return { success: true };
        }

        const { env } = getCloudflareContext();

        // Generate verification token
        const verificationToken = createId();
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS * 1000);

        if (!env?.NEXT_INC_CACHE_KV) {
          throw new ZSAError(
            "INTERNAL_SERVER_ERROR",
            "System configuration error. Please try again later."
          );
        }

        // Save verification token in KV with expiration
        await env.NEXT_INC_CACHE_KV.put(
          getVerificationTokenKey(verificationToken),
          JSON.stringify({
            userId: user.id,
            expiresAt: expiresAt.toISOString(),
          }),
          {
            expirationTtl: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
          }
        );

        // Send verification email
        await sendVerificationEmail({
          email: user.email!,
          verificationToken,
          username: user.firstName || user.email!,
        });

        return { success: true };
      },
      RATE_LIMITS.EMAIL
    );
  });