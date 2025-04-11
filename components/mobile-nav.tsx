"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { BarChart2, Home, Menu, Settings, Terminal, TrendingUp, X } from "lucide-react"

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (path: string) => pathname === path

  const routes = [
    { path: "/", label: "Dashboard", icon: <Home className="h-5 w-5 mr-3" /> },
    { path: "/backtest", label: "Backtest", icon: <BarChart2 className="h-5 w-5 mr-3" /> },
    { path: "/trading", label: "Trading", icon: <TrendingUp className="h-5 w-5 mr-3" /> },
    { path: "/settings", label: "Settings", icon: <Settings className="h-5 w-5 mr-3" /> },
    { path: "/dev-tools", label: "Dev Tools", icon: <Terminal className="h-5 w-5 mr-3" /> },
  ]

  return (
    <div className="flex justify-between items-center">
      <div className="font-bold text-lg">AI Trading</div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[250px] sm:w-[300px]">
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-lg">Menu</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="flex flex-col space-y-4">
              {routes.map((route) => (
                <Link key={route.path} href={route.path} onClick={() => setOpen(false)}>
                  <div
                    className={`flex items-center py-3 px-4 rounded-md ${
                      isActive(route.path) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {route.icon}
                    <span>{route.label}</span>
                  </div>
                </Link>
              ))}
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
