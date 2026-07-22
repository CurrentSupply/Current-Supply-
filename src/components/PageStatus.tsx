import type { ReactNode } from "react";

export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return <p className="text-sm text-[var(--muted)]">{label}</p>;
}

export function PageError({ message }: { message: string }) {
  return (
    <p className="border border-black bg-[#f3f3f3] p-3 text-sm text-[var(--danger)]">
      {message}
    </p>
  );
}

export function PageEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface rounded-none px-6 py-14 text-center">
      <h2 className="page-title text-2xl">{title}</h2>
      {description ? (
        <p className="mt-2 text-[var(--muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
