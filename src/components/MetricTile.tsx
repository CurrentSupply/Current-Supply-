type Props = {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
  hintClassName?: string;
};

export function MetricTile({
  label,
  value,
  hint,
  valueClassName,
  hintClassName,
}: Props) {
  return (
    <div className="surface rounded-none p-4">
      <p className="page-kicker">{label}</p>
      <p className={`page-title mt-2 text-2xl ${valueClassName ?? ""}`}>
        {value}
      </p>
      {hint ? (
        <p className={`mt-1 text-xs ${hintClassName ?? "text-[var(--muted)]"}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
