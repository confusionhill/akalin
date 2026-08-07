import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Building2, Plus, Ticket, ArrowRight, ShieldCheck, UserCheck, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/context/auth-context"
import { authApi } from "@/api"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export interface TenantUI {
  id: string
  name: string
  role?: string
}

export function SelectTenantPage() {
  const { auth, switchTenant, logout } = useAuth()
  const navigate = useNavigate()

  const [tenants, setTenants] = useState<TenantUI[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<string>(auth?.tenantId || "")
  const [loading, setLoading] = useState(true)
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  // Create Workspace Dialog state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [creating, setCreating] = useState(false)

  // Join Token Dialog state
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinToken, setJoinToken] = useState("")
  const [joining, setJoining] = useState(false)

  // Fetch real tenants from backend API on mount
  useEffect(() => {
    async function fetchTenants() {
      setLoading(true)
      try {
        const res = await authApi.getMyTenants()
        setTenants(
          (res || []).map((t) => ({
            id: t.id,
            name: t.name,
            role: t.master_user_id === auth?.userId ? "Owner" : "Member",
          }))
        )
      } catch (err) {
        console.error("Failed to fetch tenants:", err)
        setTenants([])
      } finally {
        setLoading(false)
      }
    }
    fetchTenants()
  }, [auth?.userId])

  const handleSelectWorkspace = async (tenant: TenantUI) => {
    setSwitchingId(tenant.id)
    try {
      await switchTenant(tenant.id)
      setSelectedTenantId(tenant.id)
      toast.success(`Switched active workspace to ${tenant.name}`)
      navigate("/projects")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to select workspace"
      toast.error(message)
    } finally {
      setSwitchingId(null)
    }
  }

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkspaceName.trim()) return

    setCreating(true)
    try {
      const created = await authApi.createTenant(newWorkspaceName.trim())
      const newTenant: TenantUI = { id: created.id, name: created.name, role: "Owner" }
      setTenants((prev) => [newTenant, ...prev])
      toast.success(`Workspace "${created.name}" created!`)
      setShowCreateModal(false)
      setNewWorkspaceName("")
      await handleSelectWorkspace(newTenant)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create workspace"
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  const handleJoinWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinToken.trim()) return

    setJoining(true)
    try {
      const joined = await authApi.joinTenant(joinToken.trim())
      const newTenant: TenantUI = { id: joined.id, name: joined.name || "Joined Workspace", role: "Member" }
      setTenants((prev) => [...prev, newTenant])
      toast.success(`Successfully joined workspace!`)
      setShowJoinModal(false)
      setJoinToken("")
      await handleSelectWorkspace(newTenant)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join workspace with token"
      toast.error(message)
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-12 relative overflow-hidden">
      {/* Background aesthetic blobs */}
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-15" />
      <div
        className="pointer-events-none absolute -top-40 -left-40 size-[500px] rounded-full bg-violet-600/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 size-[500px] rounded-full bg-indigo-500/15 blur-3xl"
        aria-hidden
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <img src="/icon.webp" alt="Akalin" className="size-full object-cover" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Akalin</h1>
            <p className="text-xs text-slate-400">LLM Prompt Evaluation Platform</p>
          </div>
        </div>

        {auth && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
              <UserCheck className="size-3.5 text-violet-400" />
              <span>Logged in as <strong className="text-slate-200">{auth.email}</strong></span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout()
                navigate("/login")
              }}
              className="text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-800"
            >
              Sign out
            </Button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="relative z-10 my-auto py-12 mx-auto w-full max-w-3xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Select Your Workspace
          </h2>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            Choose an active workspace session or create a new tenant workspace to start evaluating prompts.
          </p>
        </div>

        {/* Tenant Cards List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 className="size-8 animate-spin text-violet-500" />
            <span className="text-xs font-medium">Loading your workspaces...</span>
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-12 px-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-md mb-8">
            <Building2 className="size-12 mx-auto text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-white">No Workspaces Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              You are not a member of any workspace yet. Create a new workspace or enter an invitation token to join an existing team.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-1 mb-8">
            {tenants.map((tenant) => {
              const isActive = selectedTenantId === tenant.id
              const isSwitching = switchingId === tenant.id
              return (
                <Card
                  key={tenant.id}
                  className={`transition-all border bg-slate-900/60 backdrop-blur-md hover:border-violet-500/50 ${
                    isActive ? "ring-2 ring-violet-500 border-violet-500/80 bg-violet-950/20" : "border-slate-800"
                  }`}
                >
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${isActive ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400"}`}>
                        <Building2 className="size-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-base text-white">{tenant.name}</h3>
                          {isActive && (
                            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[10px] py-0">
                              Active Session
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="size-3 text-indigo-400" /> {tenant.role || "Member"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleSelectWorkspace(tenant)}
                      disabled={isSwitching}
                      variant={isActive ? "default" : "outline"}
                      className={isActive ? "bg-violet-600 hover:bg-violet-500" : "border-slate-700 hover:bg-slate-800 text-slate-200"}
                    >
                      {isSwitching ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : isActive ? (
                        <>
                          <Check className="mr-1.5 size-4" /> Continue
                        </>
                      ) : (
                        <>
                          Select <ArrowRight className="ml-1.5 size-4" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => setShowCreateModal(true)}
            size="lg"
            className="bg-violet-600 hover:bg-violet-500 text-white font-medium shadow-lg shadow-violet-900/30"
          >
            <Plus className="mr-2 size-5" /> Create New Workspace
          </Button>

          <Button
            onClick={() => setShowJoinModal(true)}
            variant="outline"
            size="lg"
            className="border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200"
          >
            <Ticket className="mr-2 size-5 text-indigo-400" /> Join via Token
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Akalin Platform • Release 0.1.0
      </footer>

      {/* Modal: Create Workspace */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-violet-400" /> Create Workspace
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Enter a unique name for your new organization workspace. You will be set as the Owner.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateWorkspace} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ws-name" className="text-xs font-medium text-slate-300">
                Workspace / Tenant Name
              </Label>
              <Input
                id="ws-name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="e.g. OpenAI Research Lab"
                className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating} className="bg-violet-600 hover:bg-violet-500 text-white">
                {creating && <Loader2 className="mr-2 size-4 animate-spin" />}
                Create Workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Join via Token */}
      <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="size-5 text-indigo-400" /> Join Workspace with Token
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Paste the Join Token generated by your workspace admin to access the team workspace.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleJoinWorkspace} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="join-token" className="text-xs font-medium text-slate-300">
                Join Invitation Token
              </Label>
              <Input
                id="join-token"
                value={joinToken}
                onChange={(e) => setJoinToken(e.target.value)}
                placeholder="e.g. inv-8f92a1b-4391-4e92"
                className="bg-slate-950 border-slate-800 text-slate-100 font-mono text-xs placeholder:text-slate-600"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowJoinModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={joining} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {joining && <Loader2 className="mr-2 size-4 animate-spin" />}
                Join Workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
