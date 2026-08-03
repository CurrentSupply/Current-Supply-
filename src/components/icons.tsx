type Props = {
  className?: string;
  title?: string;
};

/** Simple pencil/edit glyph — no icon package dependency. */
export function PencilIcon({ className, title }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d="M16.5 3.5 20.5 7.5 8 20H4v-4L16.5 3.5z" />
      <path d="M14 6 18 10" />
    </svg>
  );
}
