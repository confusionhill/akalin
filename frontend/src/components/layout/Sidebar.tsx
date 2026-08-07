import { NavLink, useNavigate } from "react-router-dom"
import { Bot, FlaskConical, KeyRound, LogOut, Settings, Wrench } from "lucide-react"

import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"

const navItems = [
  { to: "/projects", label: "Projects", icon: FlaskConical },
  { to: "/providers", label: "Providers", icon: KeyRound },
  { to: "/models", label: "Models", icon: Bot },
  { to: "/tools", label: "Tools", icon: Wrench },
]


export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  return (
    <aside className="bg-sidebar text-sidebar-foreground flex h-full w-[260px] flex-col border-r">
      <div className="flex h-16 items-center gap-2.5 border-b px-5">
        <div className="flex size-9 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/20">
          <img src="/icon.webp" alt="Akalin" className="size-full object-cover" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Akalin</span>
          <span className="text-muted-foreground text-[11px]">
            Promt Evaluation Pipeline
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-muted-foreground px-3 pb-1 pt-2 text-[11px] font-medium tracking-wider uppercase">
          Workspace
        </p>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Separator />
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hover:bg-sidebar-accent/60 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors outline-none">
              <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-semibold text-white">
                {auth?.fullName?.slice(0, 1).toUpperCase() ?? auth?.email?.slice(0, 1).toUpperCase() ?? "?"}
              </div>
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-medium">
                  {auth?.fullName ?? auth?.email ?? "Unknown"}
                </span>
                <span className="text-muted-foreground text-[11px]">
                  {auth?.handle ? `@${auth.handle}` : "Signed in"}
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuLabel className="truncate">
              {auth?.fullName ?? auth?.email ?? "Unknown"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              navigate("/settings")
              if (onNavigate) onNavigate()
            }}>
              <Settings className="size-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
