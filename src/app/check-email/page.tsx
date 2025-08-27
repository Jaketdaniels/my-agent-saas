import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MailOpenIcon, ArrowRightIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Check Your Email",
  description: "Please verify your email address to continue"
};

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <MailOpenIcon className="h-12 w-12 text-primary" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Check your email</h1>
          <p className="text-muted-foreground">
            We&apos;ve sent a verification link to your email address.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <ol className="space-y-3 text-left">
            <li className="flex items-start space-x-3">
              <span className="font-bold text-primary">1.</span>
              <span className="text-sm">Open your email inbox</span>
            </li>
            <li className="flex items-start space-x-3">
              <span className="font-bold text-primary">2.</span>
              <span className="text-sm">Click the verification link in the email from netM8</span>
            </li>
            <li className="flex items-start space-x-3">
              <span className="font-bold text-primary">3.</span>
              <span className="text-sm">You&apos;ll be able to sign in once verified</span>
            </li>
          </ol>
        </div>

        <div className="space-y-3">
          <Button asChild variant="outline" className="w-full">
            <Link href="/sign-in">
              <ArrowRightIcon className="mr-2 h-4 w-4" />
              Go to Sign In
            </Link>
          </Button>
          
          <p className="text-xs text-muted-foreground">
            Can&apos;t find the email? Check your spam folder.
          </p>
        </div>
      </div>
    </div>
  );
}