import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { NavBar } from "@/components/nav-bar"
import { MobileNav } from "@/components/mobile-nav"
import { TradingInitializer } from "@/components/trading-initializer"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AI Trading Agent",
  description: "AI-powered trading agent using Hugging Face models",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <TradingInitializer />
          <div className="min-h-screen flex flex-col">
            <header className="border-b sticky top-0 bg-white z-10">
              <div className="container mx-auto py-3 px-4">
                <div className="hidden md:block">
                  <NavBar />
                </div>
                <div className="md:hidden">
                  <MobileNav />
                </div>
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}


import './globals.css'