"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/inventory", label: "Inventory" },
  { href: "/dashboard", label: "Analytics" },
  { href: "/finance", label: "Finance" },
  { href: "/overlay", label: "Stamp" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-secondary)] bg-[var(--bg)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/inventory"
          className="flex shrink-0 items-center gap-3 text-[var(--text-primary)] transition-opacity hover:opacity-70"
        >
          <Image
            src="/current-supply-logo.png"
            alt="Current Supply"
            width={148}
            height={148}
            className="h-10 w-10 object-contain sm:h-11 sm:w-11"
            priority
            unoptimized
          />
          <span className="brand-wordmark hidden text-base text-[var(--text-primary)] sm:inline">
            Current Supply
          </span>
        </Link>

        <nav className="segmented-control" aria-label="Primary">
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`segmented-control-item ${
                  active ? "segmented-control-item-active" : ""
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
