import type { ReactNode } from "react";

type Props = {
  kicker?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  back?: ReactNode;
};

export function PageHeader({ kicker, title, subtitle, actions, back }: Props) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {back && <div className="mb-2">{back}</div>}
        {kicker && <p className="page-kicker hidden sm:block">{kicker}</p>}
        <h1 className="page-title text-2xl sm:text-3xl">{title}</h1>
        {subtitle && (
          <p className="page-subtitle max-w-2xl hidden sm:block">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">{actions}</div>
      )}
    </div>
  );
}
