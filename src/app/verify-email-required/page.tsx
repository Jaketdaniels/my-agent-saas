import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MailIcon, ShieldCheckIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Email Verification Required",
  description: "Please verify your email to continue"
};

export default function VerifyEmailRequiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-yellow-100 p-4 dark:bg-yellow-900/20">
            <ShieldCheckIcon className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Email Verification Required</h1>
          <p className="text-muted-foreground">
            Your email address needs to be verified before you can access this area.
          </p>
        </div>

        <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
          <div className="flex items-start space-x-3 text-left">
            <MailIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Check your inbox</p>
              <p className="text-muted-foreground">
                We&apos;ve sent a verification link to your email address. Click the link to verify your account.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/sign-in">Back to Sign In</Link>
          </Button>
          
          <p className="text-sm text-muted-foreground">
            Didn&apos;t receive the email? Check your spam folder or{" "}
            <Link href="/resend-verification" className="font-medium underline underline-offset-4 hover:text-primary">
              request a new verification email
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}