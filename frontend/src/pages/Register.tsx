import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { FlaskConical, Loader2, Check, Copy } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [tenantName, setTenantName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)

  const handleCopyToken = () => {
    const token = localStorage.getItem("llm_eval.token")
    if (token) {
      navigator.clipboard.writeText(token)
      setCopiedToken(true)
      toast.success("Token copied to clipboard")
      setTimeout(() => setCopiedToken(false), 2000)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await register(tenantName, email, password)
      toast.success("Account created successfully!")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-violet-950 via-indigo-950 to-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-20" />
        <div
          className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-violet-600/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-0 bottom-0 size-96 rounded-full bg-indigo-500/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <FlaskConical className="size-5 text-violet-200" />
          </div>
          <span className="text-lg font-semibold text-white">Akalin</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight text-white">
            Design, test, and grade your system prompts.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-violet-100/70">
            Benchmark prompts across test cases, bring your own LLM providers,
            and track every evaluation run with rubric-based scoring.
          </p>
        </div>
        <p className="text-muted-foreground relative text-xs text-violet-100/40">
          © {new Date().getFullYear()} Akalin Pipeline. All rights reserved.
        </p>
      </div>

      <div className="bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Create account</CardTitle>
            <CardDescription>
              Set up a tenant and your first user account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 bg-muted rounded-md">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium">Your Token</Label>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  {copiedToken ? (
                    <>
                      <span>Copied!</span>
                      <Check className="size-3" />
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      <span>Copy token</span>
                    </>
                  )}
                </button>
              </div>
              <div className="text-xs break-all font-mono bg-background p-2 rounded border">
                {localStorage.getItem("llm_eval.token") || "Not available yet"}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="tenant">Tenant name</Label>
                <Input
                  id="tenant"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Acme Labs"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={submitting} className="mt-2">
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Create account
              </Button>
            </form>

            <p className="text-muted-foreground mt-6 text-center text-sm">
              Already registered?{" "}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-primary hover:underline"
              >
                Sign in
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}