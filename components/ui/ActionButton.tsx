import type { ButtonHTMLAttributes, ReactNode } from "react";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
};

export function ActionButton({
  children,
  icon,
  variant = "primary",
  className = "",
  ...props
}: ActionButtonProps) {
  const variants = {
    primary:
      "bg-vermilion text-white shadow-lg shadow-vermilion/20 hover:bg-[#d94932]",
    secondary:
      "border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]",
    ghost:
      "text-[color:var(--foreground)] hover:bg-black/5 dark:hover:bg-white/10",
  };

  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
