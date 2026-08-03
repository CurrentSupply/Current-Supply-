"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/inventory", label: "Inventory", shortLabel: "Items" },
  { href: "/dashboard", label: "Analytics", shortLabel: "Stats" },
  { href: "/finance", label: "Finance", shortLabel: "Cash" },
  { href: "/overlay", label: "Stamp", shortLabel: "Stamp" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-secondary)] bg-[var(--bg)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-6 sm:py-3">
        <Link
          href="/inventory"
          className="flex shrink-0 items-center gap-2 sm:gap-3 text-[var(--text-primary)] transition-opacity hover:opacity-70"
        >
          <Image
            src="/current-supply-logo.png"
            alt="Current Supply"
            width={148}
            height={148}
            className="h-8 w-8 object-contain sm:h-11 sm:w-11"
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
                <span className="sm:hidden">{link.shortLabel}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
