"use client"
import { signIn } from "@/lib/auth-client"
import { GithubIcon } from "lucide-react"
import { useState } from "react"

const LoginUI = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGithubLogin = async () => {
    setIsLoading(true);
    try{
      await signIn.social({
        provider: "github"
      })
    } catch(error) {
      console.error("Login error:", error);
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-50 via-background to-orange-100 text-foreground flex">
      <div className="flex-1 hidden lg:flex flex-col justify-center px-16 py-20">
        <div className="max-w-xl space-y-8">
          <div className="inline-flex items-center gap-3 text-2xl font-bold">
            <div className="w-10 h-10 bg-primary rounded-2xl" />
            <span>CodeMonkey</span>
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-bold leading-tight text-balance">
              Ship reviews faster with a focused AI copilot.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Connect GitHub once and receive structured, actionable PR feedback in minutes.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">
            Github-first authentication
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center px-6 py-16">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/80 p-8 shadow-lg backdrop-blur">
          <div className="mb-10 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Secure Sign In
            </p>
            <h2 className="text-3xl font-bold">Continue with GitHub</h2>
            <p className="text-sm text-muted-foreground">
              We only support GitHub login to connect your repositories.
            </p>
          </div>

          <button
            onClick={handleGithubLogin}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
          >
            <GithubIcon size={20} />
            {isLoading ? "Signing in..." : "Sign in with GitHub"}
          </button>

          <div className="mt-8 pt-6 border-t border-border/60 text-center text-xs text-muted-foreground">
            By continuing, you agree to our Terms of Use and Privacy Policy.
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginUI