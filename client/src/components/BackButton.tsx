import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  label?: string;
  to?: string;
}

/**
 * 通用左上角返回按钮，默认返回主页 "/"
 */
export function BackButton({ label = "返回主页", to = "/" }: BackButtonProps) {
  return (
    <Link href={to}>
      <button className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors group mb-6">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span>{label}</span>
      </button>
    </Link>
  );
}
