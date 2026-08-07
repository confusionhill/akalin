import { useAuth } from "@/context/auth-context"
import { useNavigate } from "react-router-dom"
import { LogOut, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserMenu() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
  }

  const handleSwitchWorkspace = () => {
    navigate("/workspace")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">
              {auth?.fullName?.slice(0, 1).toUpperCase() ?? auth?.email?.[0]?.toUpperCase() ?? "U"}
            </span>
          </div>
          <span className="hidden sm:inline">{auth?.fullName ?? auth?.email ?? "User"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="space-y-1">
            <p className="text-sm font-medium leading-none">
              {auth?.fullName ?? auth?.email ?? "User"}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {auth?.handle ? `@${auth.handle}` : "User"}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSwitchWorkspace} className="cursor-pointer">
          <Building2 className="mr-2 h-4 w-4 text-violet-500" />
          <span>Switch Workspace</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}