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
    <div className="metric-tile">
      <p className="metric-label">{label}</p>
      <p className={`metric-value ${valueClassName ?? ""}`}>{value}</p>
      {hint && (
        <p className={`metric-hint ${hintClassName ?? ""}`}>{hint}</p>
      )}
    </div>
  );
}
