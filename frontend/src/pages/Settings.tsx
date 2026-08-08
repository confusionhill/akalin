import { useState, useEffect, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { Loader2, UserPlus, Shield, ShieldAlert, Trash2, Copy, Check, Ticket, User, Clock, Calendar, ShieldCheck, Users, Key } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/context/auth-context"
import { usersApi, authApi, apiKeysApi } from "@/api"
import { type APIKey } from "@/api/types"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface WorkspaceMemberUI {
  id: string
  fullName: string
  handle: string
  email: string
  role: string
  accessRole: number
  joinedAt: string
}

export function SettingsPage() {
  const { auth, updateAuth } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") || "profile"

  const sections = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: ShieldCheck },
    { id: "api-keys", label: "API Keys", icon: Key },
    { id: "members", label: "Workspace Members", icon: Users },
  ]

  const setActiveTab = (val: string) => {
    setSearchParams((prev) => {
      prev.set("tab", val)
      return prev
    })
  }

  // Profile Form State
  const [email, setEmail] = useState(auth?.email ?? "")
  const [handle, setHandle] = useState(auth?.handle ?? "")
  const [fullName, setFullName] = useState(auth?.fullName ?? "")
  const [savingProfile, setSavingProfile] = useState(false)

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  // Workspace Members State
  const [members, setMembers] = useState<WorkspaceMemberUI[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [expirationChoice, setExpirationChoice] = useState<string>("1-day")
  const [customDateTime, setCustomDateTime] = useState<string>("")
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [generatedToken, setGeneratedToken] = useState<string | null>(null)
  const [tokenExpiryDate, setTokenExpiryDate] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)

  // API Keys State
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [loadingApiKeys, setLoadingApiKeys] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyExpires, setNewKeyExpires] = useState("30-days")
  const [creatingApiKey, setCreatingApiKey] = useState(false)
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null)
  const [copiedApiKey, setCopiedApiKey] = useState(false)

  const currentUserRole = auth?.accessRole ?? 60

  // Fetch real workspace members from API
  useEffect(() => {
    async function fetchMembers() {
      if (!auth?.tenantId) return
      setLoadingMembers(true)
      try {
        const res = await authApi.getTenantUsers()
        if (res && res.length > 0) {
          setMembers(
            res.map((m) => ({
              id: m.user_id,
              fullName: m.full_name,
              handle: m.handle,
              email: m.email,
              role: m.access_role >= 100 ? "Owner" : m.access_role >= 60 ? "Admin" : "Member",
              accessRole: m.access_role,
              joinedAt: new Date(m.joined_at).toLocaleDateString(),
            }))
          )
        } else {
          setMembers([])
        }
      } catch (err) {
        console.error("Failed to fetch members:", err)
        setMembers([])
      } finally {
        setLoadingMembers(false)
      }
    }
    fetchMembers()
  }, [auth?.tenantId])

  useEffect(() => {
    async function fetchApiKeys() {
      if (!auth) return
      setLoadingApiKeys(true)
      try {
        const res = await apiKeysApi.list()
        setApiKeys(res || [])
      } catch (err) {
        console.error("Failed to fetch API keys:", err)
      } finally {
        setLoadingApiKeys(false)
      }
    }
    if (activeTab === "api-keys") {
      fetchApiKeys()
    }
  }, [auth, activeTab])

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await usersApi.updateProfile({ email, handle, full_name: fullName })
      updateAuth({ email: res.email, handle: res.handle, fullName: res.full_name })
      toast.success("Profile updated successfully")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile"
      toast.error(message)
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }
    setSavingPassword(true)
    try {
      await usersApi.updatePassword({ current_password: currentPassword, new_password: newPassword })
      toast.success("Password updated successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update password"
      toast.error(message)
    } finally {
      setSavingPassword(false)
    }
  }

  const handleGenerateInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setGeneratingInvite(true)
    try {
      let customISO: string | undefined = undefined
      if (expirationChoice === "custom") {
        if (!customDateTime) {
          toast.error("Please pick a custom expiration date and time")
          setGeneratingInvite(false)
          return
        }
        customISO = new Date(customDateTime).toISOString()
      }

      const res = await authApi.createInvitation(inviteEmail.trim(), expirationChoice, customISO)
      setGeneratedToken(res.token)
      setTokenExpiryDate(new Date(res.expires_at).toLocaleString())
      toast.success(`Join token generated for ${inviteEmail}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate invitation token"
      toast.error(message)
    } finally {
      setGeneratingInvite(false)
    }
  }

  const handleCopyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken)
      setCopiedToken(true)
      toast.success("Join Token copied to clipboard")
      setTimeout(() => setCopiedToken(false), 2000)
    }
  }

  const handleCreateApiKey = async (e: FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return

    setCreatingApiKey(true)
    try {
      const res = await apiKeysApi.create({ name: newKeyName.trim(), expires_in: newKeyExpires })
      setCreatedRawKey(res.raw_key)
      setApiKeys((prev) => [res.api_key, ...prev])
      toast.success("API Key created successfully")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create API key"
      toast.error(message)
    } finally {
      setCreatingApiKey(false)
    }
  }

  const handleCopyApiKey = () => {
    if (createdRawKey) {
      navigator.clipboard.writeText(createdRawKey)
      setCopiedApiKey(true)
      toast.success("API Key copied to clipboard")
      setTimeout(() => setCopiedApiKey(false), 2000)
    }
  }

  const handleDeleteApiKey = async (id: string) => {
    try {
      await apiKeysApi.delete(id)
      setApiKeys((prev) => prev.filter((k) => k.id !== id))
      toast.success("API Key deleted")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete API key"
      toast.error(message)
    }
  }

  // Role Update Modal State
  const [roleModalMember, setRoleModalMember] = useState<WorkspaceMemberUI | null>(null)
  const [targetRole, setTargetRole] = useState<number>(0)
  const [updatingRole, setUpdatingRole] = useState(false)

  const handleRoleChangeRequest = (member: WorkspaceMemberUI, newAccessRole: number) => {
    if (member.accessRole === newAccessRole) return
    setRoleModalMember(member)
    setTargetRole(newAccessRole)
  }

  const handleRoleChangeConfirm = async () => {
    if (!roleModalMember) return
    setUpdatingRole(true)
    try {
      await authApi.updateTenantUserRole(roleModalMember.id, targetRole)
      setMembers((prev) =>
        prev.map((m) =>
          m.id === roleModalMember.id
            ? {
                ...m,
                accessRole: targetRole,
                role: targetRole >= 100 ? "Owner" : targetRole >= 60 ? "Admin" : "Member",
              }
            : m
        )
      )
      const actionText = targetRole === 60 ? "promoted to Admin" : "demoted to Member"
      toast.success(`${roleModalMember.fullName} has been ${actionText}`)
      setRoleModalMember(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update member role"
      toast.error(message)
    } finally {
      setUpdatingRole(false)
    }
  }

  const handleRemoveMember = async (member: WorkspaceMemberUI) => {
    if (member.accessRole >= 60 && currentUserRole <= 60 && member.email !== auth?.email) {
      toast.error("Admins cannot remove other Admins. Only the workspace Owner can.")
      return
    }

    try {
      await authApi.removeTenantUser(member.id)
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
      toast.success(`Removed ${member.fullName} from workspace`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove member"
      toast.error(message)
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-5xl flex flex-col md:flex-row gap-8 items-start relative">
          
          {/* Mobile sticky header/selector */}
          <div className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur border-b py-3 mb-4 -mx-4 px-4 w-[calc(100%+2rem)] flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Section:</span>
            <Select value={activeTab} onValueChange={(val) => setActiveTab(val)}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop Sidebar */}
          <aside className="hidden md:block w-64 shrink-0 sticky top-6 space-y-1 bg-card border rounded-lg p-3 shadow-xs">
            <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wider px-3 mb-2">
              Settings Navigation
            </div>
            {sections.map((s) => {
              const isActive = activeTab === s.id
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveTab(s.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {s.label}
                </button>
              )
            })}
          </aside>

          <div className="flex-1 min-w-0 w-full">
            {activeTab === "profile" && (
              <Card>
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>
                    Update your public handle and email address.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="handle">Handle</Label>
                      <Input
                        id="handle"
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        placeholder="johndoe"
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
                      />
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button type="submit" disabled={savingProfile}>
                        {savingProfile && <Loader2 className="mr-2 size-4 animate-spin" />}
                        Save changes
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {activeTab === "security" && (
              <Card>
                <CardHeader>
                  <CardTitle>Password</CardTitle>
                  <CardDescription>
                    Change your password to keep your account secure.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button type="submit" disabled={savingPassword}>
                        {savingPassword && <Loader2 className="mr-2 size-4 animate-spin" />}
                        Update password
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {activeTab === "api-keys" && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div>
                    <CardTitle className="text-lg">API Keys</CardTitle>
                    <CardDescription className="text-xs">
                      Manage API keys for accessing prompts from external applications.
                    </CardDescription>
                  </div>
                  <Button onClick={() => { setCreatedRawKey(null); setNewKeyName(""); setNewKeyExpires("30-days"); setShowApiKeyModal(true) }}>
                    <Key className="mr-2 size-4" /> Create API Key
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingApiKeys ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="size-6 animate-spin text-primary" />
                    </div>
                  ) : apiKeys.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      No API keys generated yet.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Last Used</TableHead>
                          <TableHead>Expires At</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiKeys.map((key) => (
                          <TableRow key={key.id}>
                            <TableCell className="font-medium text-sm">{key.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {key.expires_at ? new Date(key.expires_at).toLocaleDateString() : "Never"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteApiKey(key.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "members" && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div>
                    <CardTitle className="text-lg">Workspace Members</CardTitle>
                    <CardDescription className="text-xs">
                      Manage tenant members, roles, and invitation tokens for self-hosted access.
                    </CardDescription>
                  </div>
                  <Button onClick={() => { setGeneratedToken(null); setInviteEmail(""); setExpirationChoice("1-day"); setCustomDateTime(""); setShowInviteModal(true) }}>
                    <UserPlus className="mr-2 size-4" /> Generate Join Token
                  </Button>
                </CardHeader>

                <CardContent>
                  {loadingMembers ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="size-6 animate-spin text-violet-500" />
                    </div>
                  ) : members.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      No member list data available for this workspace session.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Joined Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((member) => {
                          const isOwner = member.role === "Owner"
                          const isAdmin = member.role === "Admin"
                          return (
                            <TableRow key={member.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="flex size-8 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 font-semibold text-xs border border-violet-500/20">
                                    {member.fullName[0]}
                                  </div>
                                  <div>
                                    <div className="font-medium text-sm">{member.fullName}</div>
                                    <div className="text-xs text-muted-foreground">{member.email} • @{member.handle}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {currentUserRole >= 100 && !isOwner ? (
                                  <Select
                                    value={String(member.accessRole >= 60 ? 60 : 0)}
                                    onValueChange={(val) => handleRoleChangeRequest(member, parseInt(val, 10))}
                                  >
                                    <SelectTrigger className="w-[120px] h-8 text-xs font-medium">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="0">
                                        <div className="flex items-center gap-1.5 text-slate-600">
                                          <User className="size-3.5" /> Member
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="60">
                                        <div className="flex items-center gap-1.5 text-violet-600">
                                          <Shield className="size-3.5" /> Admin
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className={
                                      isOwner
                                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                        : isAdmin
                                        ? "bg-violet-500/10 text-violet-600 border-violet-500/30"
                                        : "bg-slate-500/10 text-slate-600 border-slate-500/30"
                                    }
                                  >
                                    {isOwner && <ShieldAlert className="mr-1 size-3" />}
                                    {isAdmin && <Shield className="mr-1 size-3" />}
                                    {!isOwner && !isAdmin && <User className="mr-1 size-3" />}
                                    {member.role}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {member.joinedAt}
                              </TableCell>
                              <TableCell className="text-right">
                                {!isOwner && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:bg-destructive/10"
                                    onClick={() => handleRemoveMember(member)}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Generate Join Token */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="size-5 text-violet-600" /> Generate Join Token
            </DialogTitle>
            <DialogDescription className="text-xs">
              Generate a unique invitation token bound to a target email with a preset or custom expiration date and hour.
            </DialogDescription>
          </DialogHeader>

          {!generatedToken ? (
            <form onSubmit={handleGenerateInvite} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="invite-email" className="text-xs font-medium">
                  Target User Email
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="newuser@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground" /> Token Expiration
                </Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: "1-day", label: "1 Day" },
                    { id: "3-days", label: "3 Days" },
                    { id: "7-days", label: "1 Week" },
                    { id: "30-days", label: "30 Days" },
                    { id: "custom", label: "Custom" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setExpirationChoice(item.id)}
                      className={`text-xs px-2.5 py-2 rounded-md border font-medium transition-all ${
                        expirationChoice === item.id
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-background hover:bg-muted text-muted-foreground border-input"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {expirationChoice === "custom" && (
                  <div className="pt-2 space-y-1.5">
                    <Label htmlFor="custom-datetime" className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3" /> Select Expiration Date & Hour
                    </Label>
                    <Input
                      id="custom-datetime"
                      type="datetime-local"
                      value={customDateTime}
                      onChange={(e) => setCustomDateTime(e.target.value)}
                      className="text-xs"
                      required
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={generatingInvite} className="bg-violet-600 hover:bg-violet-500 text-white">
                  {generatingInvite && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Generate Token
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Target Email: <strong className="text-foreground">{inviteEmail}</strong></span>
                  <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/20 text-[10px]">
                    <Clock className="mr-1 size-3" /> Expires: {tokenExpiryDate}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 font-mono text-xs p-2 bg-background border rounded break-all select-all">
                    {generatedToken}
                  </div>
                  <Button size="sm" onClick={handleCopyToken} className="shrink-0">
                    {copiedToken ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => setShowInviteModal(false)}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Role Change Warning Confirmation */}
      <Dialog open={!!roleModalMember} onOpenChange={(open) => !open && setRoleModalMember(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-amber-500" />
              {targetRole === 60 ? "Promote Member to Admin?" : "Demote Admin to Member?"}
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 space-y-2">
              {targetRole === 60 ? (
                <>
                  Are you sure you want to promote <strong className="text-foreground">{roleModalMember?.fullName}</strong> (@{roleModalMember?.handle}) to <strong>Workspace Admin</strong>?
                  <span className="block text-muted-foreground pt-1">
                    Admins can configure LLM providers, manage evaluation models, create project tools, and invite new members.
                  </span>
                </>
              ) : (
                <>
                  Are you sure you want to demote <strong className="text-foreground">{roleModalMember?.fullName}</strong> (@{roleModalMember?.handle}) to <strong>Member</strong>?
                  <span className="block text-muted-foreground pt-1">
                    Members cannot modify workspace LLM providers or manage system-wide evaluation configurations.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRoleModalMember(null)}
              disabled={updatingRole}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRoleChangeConfirm}
              disabled={updatingRole}
              className={targetRole === 60 ? "bg-violet-600 hover:bg-violet-500 text-white" : "bg-amber-600 hover:bg-amber-500 text-white"}
            >
              {updatingRole && <Loader2 className="mr-2 size-4 animate-spin" />}
              {targetRole === 60 ? "Confirm Promotion" : "Confirm Demotion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Generate API Key */}
      <Dialog open={showApiKeyModal} onOpenChange={setShowApiKeyModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="size-5 text-primary" /> Create API Key
            </DialogTitle>
            <DialogDescription className="text-xs">
              Generate a new API key to authenticate your external requests.
            </DialogDescription>
          </DialogHeader>

          {!createdRawKey ? (
            <form onSubmit={handleCreateApiKey} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="api-key-name" className="text-xs font-medium">
                  Name
                </Label>
                <Input
                  id="api-key-name"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production Client"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Expiration</Label>
                <Select value={newKeyExpires} onValueChange={setNewKeyExpires}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7-days">7 Days</SelectItem>
                    <SelectItem value="30-days">30 Days</SelectItem>
                    <SelectItem value="90-days">90 Days</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowApiKeyModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creatingApiKey}>
                  {creatingApiKey && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Create Key
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="text-xs font-medium text-amber-600 dark:text-amber-500 mb-2">
                  <ShieldAlert className="inline mr-1 size-3" /> Please copy your API key now. You won't be able to see it again!
                </div>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Name: <strong className="text-foreground">{newKeyName}</strong></span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 font-mono text-xs p-2 bg-background border rounded break-all select-all">
                    {createdRawKey}
                  </div>
                  <Button size="sm" onClick={handleCopyApiKey} className="shrink-0">
                    {copiedApiKey ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => setShowApiKeyModal(false)}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
