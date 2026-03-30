import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import PixelCat from "@/components/PixelCat";
import {
  Mic2,
  Lightbulb,
  Users,
  BookOpen,
  Sparkles,
  ClipboardCheck,
  Home,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", icon: Home, label: "首页", color: "text-slate-600" },
  { path: "/meetings", icon: Mic2, label: "会议转待办", color: "text-violet-600", bg: "bg-violet-50" },
  { path: "/ideas", icon: Lightbulb, label: "想法落地页", color: "text-amber-600", bg: "bg-amber-50" },
  { path: "/interviews", icon: Users, label: "用户访谈", color: "text-emerald-600", bg: "bg-emerald-50" },
  { path: "/knowledge", icon: BookOpen, label: "设计知识库", color: "text-sky-600", bg: "bg-sky-50" },
  { path: "/inspiration", icon: Sparkles, label: "灵感碰撞墙", color: "text-pink-600", bg: "bg-pink-50" },
  { path: "/reviews", icon: ClipboardCheck, label: "方案评审", color: "text-indigo-600", bg: "bg-indigo-50" },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [activityLevel, setActivityLevel] = useState(0);
  const activityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpActivity = () => {
    setActivityLevel(prev => Math.min(10, prev + 2));
    if (activityTimer.current) clearTimeout(activityTimer.current);
    activityTimer.current = setTimeout(() => setActivityLevel(prev => Math.max(0, prev - 1)), 30000);
  };

  useEffect(() => {
    window.addEventListener('click', bumpActivity);
    return () => window.removeEventListener('click', bumpActivity);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300 ease-in-out",
          "bg-card border-r border-border",
          collapsed ? "w-16" : "w-60"
        )}
        style={{ boxShadow: "2px 0 16px oklch(0.12 0.01 240 / 0.04)" }}
      >
        {/* Logo */}
        <div className={cn("flex items-center h-16 px-4 border-b border-border shrink-0", collapsed ? "justify-center" : "gap-3")}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">D</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-display font-700 text-sm leading-tight text-foreground truncate">Design Canvas</p>
              <p className="text-[10px] text-muted-foreground truncate">设计协作平台</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link href={item.path}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150",
                        "hover:bg-accent/60",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground",
                        collapsed && "justify-center px-2"
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        isActive ? "bg-primary/15" : item.bg || "bg-muted"
                      )}>
                        <Icon className={cn("w-4 h-4", isActive ? "text-primary" : item.color)} />
                      </div>
                      {!collapsed && (
                        <span className="text-sm truncate">{item.label}</span>
                      )}
                      {isActive && !collapsed && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                  </Link>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}

          {/* Divider */}
          <div className="my-2 border-t border-border" />

          {/* Blindbox */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link href="/blindbox">
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150",
                  "hover:bg-amber-50",
                  location === "/blindbox" ? "bg-amber-50 text-amber-700 font-medium" : "text-muted-foreground",
                  collapsed && "justify-center px-2"
                )}>
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <Gift className="w-4 h-4 text-amber-500" />
                  </div>
                  {!collapsed && <span className="text-sm">灵感盲盒</span>}
                  {!collapsed && (
                    <span className="ml-auto text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">彩蛋</span>
                  )}
                </div>
              </Link>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right"><p>灵感盲盒</p></TooltipContent>}
          </Tooltip>
        </nav>

        {/* User & Collapse */}
        <div className="border-t border-border p-2 space-y-1 shrink-0">
          {/* User */}
          {isAuthenticated ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-accent/60 cursor-pointer transition-colors",
                  collapsed && "justify-center px-2"
                )}>
                  <Avatar className="w-7 h-7 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                      {user?.name?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-medium truncate">{user?.name || "设计师"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user?.email || ""}</p>
                    </div>
                  )}
                  {!collapsed && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.preventDefault(); logout(); }}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right"><p>{user?.name || "设计师"}</p></TooltipContent>}
            </Tooltip>
          ) : (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <a href={getLoginUrl()} className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-primary/10 cursor-pointer transition-colors text-muted-foreground hover:text-primary",
                  collapsed && "justify-center px-2"
                )}>
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <LogIn className="w-4 h-4 text-primary" />
                  </div>
                  {!collapsed && <span className="text-sm">登录</span>}
                </a>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right"><p>登录</p></TooltipContent>}
            </Tooltip>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-accent/60 transition-colors text-muted-foreground hover:text-foreground",
              collapsed && "justify-center px-2"
            )}
          >
            <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </div>
            {!collapsed && <span className="text-xs">收起侧边栏</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300 ease-in-out min-h-screen",
          collapsed ? "ml-16" : "ml-60"
        )}
      >
        {children}
      </main>

      {/* Pixel Cat Pet */}
      <PixelCat activityLevel={activityLevel} />
    </div>
  );
}
