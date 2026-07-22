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
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        {kicker ? <p className="page-kicker">{kicker}</p> : null}
        <h1
          className={`page-title text-3xl sm:text-4xl ${
            kicker ? "mt-1" : back ? "mt-2" : ""
          }`}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-[var(--muted)]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
