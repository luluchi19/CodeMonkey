import { requireAuth } from "@/module/auth/utils/auth-utils";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";

const AuthRedirect = async () => {
  await requireAuth();
  return redirect("/dashboard");
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="size-6" />
        </div>
      }
    >
      <AuthRedirect />
    </Suspense>
  );
}
