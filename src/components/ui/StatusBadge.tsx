type StatusBadgeProps = {
  status: "sold" | "in_stock";
  variant?: "badge" | "text" | "dot";
  className?: string;
};

export function StatusBadge({
  status,
  variant = "badge",
  className = "",
}: StatusBadgeProps) {
  const isSold = status === "sold";
  const label = isSold ? "Sold" : "In Stock";

  if (variant === "dot") {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <span
          className={`w-2 h-2 rounded-full ${
            isSold ? "bg-[var(--text-tertiary)]" : "bg-[var(--color-success)]"
          }`}
        />
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      </span>
    );
  }

  if (variant === "text") {
    return (
      <span
        className={`text-xs font-medium uppercase tracking-wide ${
          isSold ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"
        } ${className}`}
      >
        {label}
      </span>
    );
  }

  return (
    <span className={`badge ${isSold ? "badge-sold" : "badge-stock"} ${className}`}>
      {label}
    </span>
  );
}
