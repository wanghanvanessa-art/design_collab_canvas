import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mic2, Lightbulb, Users, BookOpen, Sparkles, Search,
  LogOut, Gift, LayoutGrid
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/meetings", label: "会议转待办", icon: Mic2 },
  { href: "/ideas", label: "想法落地", icon: Lightbulb },
  { href: "/interviews", label: "用户访谈", icon: Users },
  { href: "/knowledge", label: "知识库", icon: BookOpen },
  { href: "/inspiration", label: "灵感墙", icon: Sparkles },
  { href: "/reviews", label: "方案评审", icon: Search },
];

export default function TopNav() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-gray-100">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <LayoutGrid className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-700 text-base text-foreground tracking-tight">Design Canvas</span>
        </Link>

        {/* Nav Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                location === href
                  ? "bg-violet-50 text-violet-700"
                  : "text-muted-foreground hover:text-foreground hover:bg-gray-50"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Blindbox */}
          <Link href="/blindbox">
            <Button variant="ghost" size="sm" className="rounded-lg gap-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700">
              <Gift className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">灵感盲盒</span>
            </Button>
          </Link>

          {/* Auth */}
          {isAuthenticated ? (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-600">
                      {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm font-medium text-foreground max-w-[80px] truncate">
                    {user?.name || "用户"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl w-40">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer rounded-lg"
                  onClick={() => logoutMutation.mutate()}
                >
                  <LogOut className="w-4 h-4 mr-2" />退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <a href={getLoginUrl()}>
              <Button size="sm" className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white">
                登录
              </Button>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
