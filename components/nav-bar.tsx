"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { BarChart2, Home, Settings, Terminal, TrendingUp } from "lucide-react"

export function NavBar() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  return (
    <div className="flex items-center space-x-2 lg:space-x-4">
      <Button variant={isActive("/") ? "default" : "ghost"} size="sm" asChild>
        <Link href="/">
          <Home className="h-4 w-4 mr-2" />
          Dashboard
        </Link>
      </Button>

      <Button variant={isActive("/backtest") ? "default" : "ghost"} size="sm" asChild>
        <Link href="/backtest">
          <BarChart2 className="h-4 w-4 mr-2" />
          Backtest
        </Link>
      </Button>

      <Button variant={isActive("/trading") ? "default" : "ghost"} size="sm" asChild>
        <Link href="/trading">
          <TrendingUp className="h-4 w-4 mr-2" />
          Trading
        </Link>
      </Button>

      <Button variant={isActive("/settings") ? "default" : "ghost"} size="sm" asChild>
        <Link href="/settings">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Link>
      </Button>

      <Button variant={isActive("/dev-tools") ? "default" : "ghost"} size="sm" asChild>
        <Link href="/dev-tools">
          <Terminal className="h-4 w-4 mr-2" />
          Dev Tools
        </Link>
      </Button>
    </div>
  )
}
