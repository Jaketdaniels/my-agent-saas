import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { signOutAction } from "@/actions/sign-out.action";

export default function VerifyEmailRequired() {
  return (
    <div className="min-h-[90vh] flex flex-col items-center px-4 justify-center bg-background my-6 md:my-10">
      <Card className="w-full max-w-md space-y-6 p-6 md:p-10 bg-card rounded-xl shadow-lg border border-border">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-yellow-600 dark:text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Verify Your Email
            </h2>
            <p className="mt-2 text-muted-foreground">
              Please verify your email address to continue
            </p>
          </div>
          
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              We&apos;ve sent a verification email to your registered email address. 
              Please check your inbox and click the verification link.
            </p>
            <p>
              If you don&apos;t see the email, check your spam folder or request a new verification email.
            </p>
          </div>
          
          <div className="pt-4 space-y-3">
            <Button asChild className="w-full">
              <Link href="/resend-verification">
                Resend Verification Email
              </Link>
            </Button>
            
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-foreground-muted"></div>
              <span className="flex-shrink mx-4">
                <span className="text-xs uppercase text-muted-foreground">Or</span>
              </span>
              <div className="flex-grow border-t border-foreground-muted"></div>
            </div>
            
            <form action={signOutAction}>
              <Button 
                type="submit" 
                variant="outline" 
                className="w-full"
              >
                Sign Out and Try Again
              </Button>
            </form>
          </div>
          
          <p className="text-xs text-muted-foreground pt-4">
            Need help? Contact support at{" "}
            <a 
              href="mailto:support@netm8.com" 
              className="text-primary hover:underline font-medium"
            >
              support@netm8.com
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}