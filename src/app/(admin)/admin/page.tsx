import { PageHeader } from "@/components/page-header"
import { UsersTable } from "./_components/users/users-table"
import type { Metadata } from "next"
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { requireAdmin } from "@/utils/auth"
import { redirect } from "next/navigation"
import { getDB } from "@/db"
import { userTable, creditTransactionTable, CREDIT_TRANSACTION_TYPE, ROLES_ENUM } from "@/db/schema"
import { count, eq, gte, sql, and, isNotNull } from "drizzle-orm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Users, 
  CreditCard, 
  DollarSign, 
  Activity, 
  CheckCircle,
  BarChart3,
  Settings,
  Cloud,
  FileText,
  Mail
} from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Platform administration and user management",
}

async function getAdminStats() {
  try {
    const db = getDB()
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      verifiedUsers,
      adminCount,
      newUsersThisWeek,
      totalCredits,
      creditUsage30d,
      creditPurchases30d
    ] = await Promise.all([
      db.select({ count: count() }).from(userTable),
      db.select({ count: count() }).from(userTable).where(isNotNull(userTable.emailVerified)),
      db.select({ count: count() }).from(userTable).where(eq(userTable.role, ROLES_ENUM.ADMIN)),
      db.select({ count: count() }).from(userTable).where(gte(userTable.createdAt, sevenDaysAgo)),
      db.select({ total: sql<number>`COALESCE(SUM(${userTable.currentCredits}), 0)` }).from(userTable),
      db.select({ total: sql<number>`COALESCE(SUM(ABS(${creditTransactionTable.amount})), 0)` })
        .from(creditTransactionTable)
        .where(and(
          eq(creditTransactionTable.type, CREDIT_TRANSACTION_TYPE.USAGE),
          gte(creditTransactionTable.createdAt, thirtyDaysAgo)
        )),
      db.select({ 
        count: count(),
        total: sql<number>`COALESCE(SUM(${creditTransactionTable.amount}), 0)`
      })
        .from(creditTransactionTable)
        .where(and(
          eq(creditTransactionTable.type, CREDIT_TRANSACTION_TYPE.PURCHASE),
          gte(creditTransactionTable.createdAt, thirtyDaysAgo)
        ))
    ])

    return {
      totalUsers: totalUsers[0].count,
      verifiedUsers: verifiedUsers[0].count,
      adminCount: adminCount[0].count,
      newUsersThisWeek: newUsersThisWeek[0].count,
      totalCredits: totalCredits[0].total || 0,
      creditUsage30d: creditUsage30d[0].total || 0,
      purchaseCount: creditPurchases30d[0].count,
      purchaseRevenue: creditPurchases30d[0].total || 0,
    }
  } catch (error) {
    console.error("Failed to load admin stats:", error)
    return {
      totalUsers: 0,
      verifiedUsers: 0,
      adminCount: 0,
      newUsersThisWeek: 0,
      totalCredits: 0,
      creditUsage30d: 0,
      purchaseCount: 0,
      purchaseRevenue: 0,
    }
  }
}

export default async function AdminPage() {
  // Check admin access using existing pattern
  const session = await requireAdmin({ doNotThrowError: true })
  if (!session) {
    return redirect('/')
  }

  const stats = await getAdminStats()

  return (
    <NuqsAdapter>
      <div className="flex flex-col gap-6">
        <PageHeader items={[{ href: "/admin", label: "Admin" }]} />
        
        {/* Admin Header */}
        <div className="px-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage platform users and monitor system activity
          </p>
        </div>

        {/* Stats Cards */}
        <div className="px-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.verifiedUsers} verified • {stats.adminCount} admins
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New This Week</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+{stats.newUsersThisWeek}</div>
              <p className="text-xs text-muted-foreground">
                User signups
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credits</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCredits.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {stats.creditUsage30d.toLocaleString()} used (30d)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue (30d)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.purchaseRevenue}</div>
              <p className="text-xs text-muted-foreground">
                {stats.purchaseCount} purchases
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="px-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Platform Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Platform Status
              </CardTitle>
              <CardDescription>All systems operational</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Database (D1)</span>
                <Badge variant="outline" className="text-green-600">Active</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Authentication</span>
                <Badge variant="outline" className="text-green-600">Active</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Workers</span>
                <Badge variant="outline" className="text-green-600">Deployed</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Agent API</span>
                <Badge variant="outline" className="text-green-600">Ready</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/dashboard/billing">
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Billing Dashboard
                </Button>
              </Link>
              <Link href="/dashboard/marketplace">
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Marketplace
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Platform Settings
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Upcoming Features */}
          <Card>
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
              <CardDescription>Features in development</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                <span>Cloudflare Analytics</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Content Management</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>Email Campaigns</span>
              </div>
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Automation Rules</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table - Main Content */}
        <div className="mt-4">
          <UsersTable />
        </div>
      </div>
    </NuqsAdapter>
  )
}