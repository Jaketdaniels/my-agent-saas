import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldXIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Access Denied",
  description: "You don't have permission to access this resource"
};

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/20">
            <ShieldXIcon className="h-12 w-12 text-red-600 dark:text-red-400" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">403 - Access Denied</h1>
          <p className="text-muted-foreground">
            You don&apos;t have permission to access this resource.
          </p>
        </div>

        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          
          <p className="text-sm text-muted-foreground">
            If you believe this is an error, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
}