"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/inventory", label: "Inventory" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/overlay", label: "Listing Stamp" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)]/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/inventory" className="brand-mark text-2xl font-[family-name:var(--font-display)] font-semibold tracking-tight">
          Reselling
        </Link>
        <nav className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-white/80 p-1">
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
