import { AdminSidebar } from "./_components/admin-sidebar"
import { requireAdminAuth } from "@/lib/auth"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAuth()

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset className="w-full flex flex-col">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
