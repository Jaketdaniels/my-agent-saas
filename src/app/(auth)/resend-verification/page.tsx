"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { toast } from "sonner";
import { resendVerificationByEmailAction } from "../resend-verification.action";

export default function ResendVerification() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setIsLoading(true);
    
    try {
      const [result, error] = await resendVerificationByEmailAction({ email });
      
      if (result) {
        setIsSuccess(true);
        toast.success("Verification email sent! Check your inbox.");
      } else if (error) {
        toast.error(error.message || "Failed to send verification email");
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[90vh] flex flex-col items-center px-4 justify-center bg-background my-6 md:my-10">
        <Card className="w-full max-w-md space-y-6 p-6 md:p-10 bg-card rounded-xl shadow-lg border border-border">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-green-600 dark:text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Email Sent!
              </h2>
              <p className="mt-2 text-muted-foreground">
                Check your inbox for the verification link
              </p>
            </div>
            
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                We&apos;ve sent a new verification email to <strong>{email}</strong>
              </p>
              <p>
                The link will expire in 30 minutes. If you don&apos;t see the email, 
                please check your spam folder.
              </p>
            </div>
            
            <div className="pt-4">
              <Button asChild className="w-full">
                <Link href="/sign-in">
                  Return to Sign In
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[90vh] flex flex-col items-center px-4 justify-center bg-background my-6 md:my-10">
      <Card className="w-full max-w-md space-y-6 p-6 md:p-10 bg-card rounded-xl shadow-lg border border-border">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-blue-600 dark:text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
              />
            </svg>
          </div>
          
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Resend Verification Email
            </h2>
            <p className="mt-2 text-muted-foreground">
              Enter your email to receive a new verification link
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              className="w-full"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send Verification Email"}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link 
              href="/sign-in" 
              className="text-primary hover:underline font-medium"
            >
              Sign In
            </Link>
          </p>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link 
              href="/sign-up" 
              className="text-primary hover:underline font-medium"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}