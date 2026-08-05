import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Menu, Moon, Sun, X } from "lucide-react"

import { Sidebar } from "@/components/layout/Sidebar"
import { useTheme } from "@/lib/theme"
import { Button } from "@/components/ui/button"

export function AppLayout() {
  const { theme, toggle } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="bg-background text-foreground flex h-screen w-full overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="bg-black/60 absolute inset-0 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full">
            <div className="absolute top-3 right-[-44px] z-20">
              <Button
                variant="ghost"
                size="icon"
                className="bg-background/80 text-foreground backdrop-blur"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
            <h1 className="text-base font-semibold tracking-tight">
              Evaluation Pipeline
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>
          </div>
        </header>
        <main className="bg-grid relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
