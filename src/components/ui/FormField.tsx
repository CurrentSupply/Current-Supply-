import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

type BaseFieldProps = {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
};

type InputFieldProps = BaseFieldProps & {
  type?: "text" | "email" | "password" | "number" | "date" | "datetime-local" | "tel" | "url";
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

export function InputField({
  label,
  hint,
  error,
  required,
  className = "",
  id,
  ...props
}: InputFieldProps) {
  const fieldId = id ?? `field-${label?.toLowerCase().replace(/\s+/g, "-")}`;
  
  return (
    <div className={`field ${error ? "field-error" : ""} ${className}`}>
      {label && (
        <label htmlFor={fieldId} className="field-label">
          {label}
          {required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
        </label>
      )}
      <input id={fieldId} {...props} />
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error-message">{error}</span>}
    </div>
  );
}

type SelectFieldProps = BaseFieldProps & {
  children: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className">;

export function SelectField({
  label,
  hint,
  error,
  required,
  className = "",
  id,
  children,
  ...props
}: SelectFieldProps) {
  const fieldId = id ?? `field-${label?.toLowerCase().replace(/\s+/g, "-")}`;
  
  return (
    <div className={`field ${error ? "field-error" : ""} ${className}`}>
      {label && (
        <label htmlFor={fieldId} className="field-label">
          {label}
          {required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
        </label>
      )}
      <select id={fieldId} {...props}>
        {children}
      </select>
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error-message">{error}</span>}
    </div>
  );
}

type TextareaFieldProps = BaseFieldProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">;

export function TextareaField({
  label,
  hint,
  error,
  required,
  className = "",
  id,
  ...props
}: TextareaFieldProps) {
  const fieldId = id ?? `field-${label?.toLowerCase().replace(/\s+/g, "-")}`;
  
  return (
    <div className={`field ${error ? "field-error" : ""} ${className}`}>
      {label && (
        <label htmlFor={fieldId} className="field-label">
          {label}
          {required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
        </label>
      )}
      <textarea id={fieldId} {...props} />
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error-message">{error}</span>}
    </div>
  );
}

type CheckboxFieldProps = {
  label: string;
  hint?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

export function CheckboxField({
  label,
  hint,
  className = "",
  id,
  ...props
}: CheckboxFieldProps) {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <input
        type="checkbox"
        id={fieldId}
        className="mt-1 h-4 w-4 rounded border-[var(--border-primary)] accent-[var(--text-primary)]"
        {...props}
      />
      <div>
        <label htmlFor={fieldId} className="text-sm font-medium text-[var(--text-primary)] cursor-pointer">
          {label}
        </label>
        {hint && <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}
