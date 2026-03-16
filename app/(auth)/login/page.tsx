import LoginUI from '@/module/auth/components/login-ui'
import { requireUnAuth } from '@/module/auth/utils/auth-utils';
import React, { Suspense } from 'react'
import { Spinner } from "@/components/ui/spinner";

const LoginGate = async () => {
  await requireUnAuth();
  return <LoginUI />
}

const LoginPage = () => {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="size-6" />
        </div>
      }
    >
      <LoginGate />
    </Suspense>
  )
}

export default LoginPage