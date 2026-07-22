"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/inventory", label: "Inventory" },
  { href: "/dashboard", label: "Analytics" },
  { href: "/finance", label: "Finance" },
  { href: "/overlay", label: "Listing Stamp" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/inventory" className="flex shrink-0 items-center gap-3 text-black">
          <Image
            src="/current-supply-logo.png"
            alt="Current Supply"
            width={148}
            height={148}
            className="h-11 w-11 object-contain object-left sm:h-12 sm:w-12"
            priority
            unoptimized
          />
          <span className="brand-wordmark hidden text-sm text-black sm:inline">
            Current Supply
          </span>
        </Link>
        <nav className="flex items-center gap-0 border border-black">
          {links.map((link, index) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 text-[0.72rem] font-bold uppercase tracking-[0.12em] transition sm:px-4 ${
                  index > 0 ? "border-l border-black" : ""
                } ${
                  active
                    ? "nav-tab-active bg-black text-white"
                    : "bg-white text-black hover:bg-[#f3f3f3]"
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
