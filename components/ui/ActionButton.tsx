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
  // Primary and secondary are the chunky 3D buttons (globals.css .btn-3d).
  const variants = {
    primary: "btn-3d",
    secondary: "btn-3d btn-3d-plain",
    ghost:
      "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold text-[color:var(--foreground)] transition hover:bg-black/5 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/10",
  };

  return (
    <button
      type="button"
      className={`${variants[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
