import type { ReactNode } from "react";

type SectionProps = {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
};

export function Section({
  title,
  subtitle,
  action,
  children,
  padding = "md",
  className = "",
}: SectionProps) {
  const paddingClasses = {
    none: "",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className={`flex items-center justify-between gap-4 ${padding !== "none" ? paddingClasses[padding] : "p-5"} pb-0`}>
          <div>
            {title && (
              <h2 className="text-heading text-lg">{title}</h2>
            )}
            {subtitle && (
              <p className="text-caption mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={paddingClasses[padding]}>{children}</div>
    </section>
  );
}

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({ title, subtitle, action, className = "" }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <div>
        <h2 className="text-heading text-lg">{title}</h2>
        {subtitle && <p className="text-caption mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
