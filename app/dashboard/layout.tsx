import React, { Suspense } from 'react'
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from '@/components/ui/separator'
import { requireAuth } from '@/module/auth/utils/auth-utils'
import { Spinner } from "@/components/ui/spinner";
import { ReviewNotifier } from "@/module/review/components/review-notifier";

const AuthenticatedLayout = async (
  {children}: { children: React.ReactNode}
) => {
  await requireAuth();
  return (
    <SidebarProvider>
      <ReviewNotifier />
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-2 h-4"/>
          <h1 className='text-xl font-semibold text-foreground'>Dashboard</h1>
        </header>
        <main className='flex-1 overflow-auto p-4 md:p-6'>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="size-6" />
        </div>
      }
    >
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </Suspense>
  )
}

export default DashboardLayout