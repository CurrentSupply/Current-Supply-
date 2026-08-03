import type { ReactNode } from "react";

type AlertProps = {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
};

export function Alert({
  variant = "info",
  title,
  children,
  className = "",
  icon,
}: AlertProps) {
  return (
    <div className={`alert alert-${variant} ${className}`} role="alert">
      {icon && <div className="shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold mb-1">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

type InlineErrorProps = {
  message?: string | null;
  className?: string;
};

export function InlineError({ message, className = "" }: InlineErrorProps) {
  if (!message) return null;
  return (
    <p className={`text-[var(--color-error)] text-sm ${className}`} role="alert">
      {message}
    </p>
  );
}
