// Shared typography for the /legal pages. Plain HTML on purpose: these are
// static server components and must not touch uikit compound components
// (see components/rsc-safe-uikit.tsx for why).

import Link from "next/link";
import type { ReactNode } from "react";

export function LegalTitle({ updated, children }: { updated: string; children: ReactNode }) {
  return (
    <header className="border-b border-separator pb-6">
      <h1 className="mb-2 text-[34px] tracking-[-0.03em] min-[721px]:text-[42px]">{children}</h1>
      <p className="m-0 text-[13px] text-muted">Last updated: {updated}</p>
    </header>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-3 text-[20px] tracking-[-0.02em]">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-[15px] leading-[1.7] text-muted [&_a]:font-medium [&_a]:text-accent [&_strong]:font-semibold [&_strong]:text-foreground">
      {children}
    </p>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="m-0 list-disc space-y-2 pl-5 text-[15px] leading-[1.7] text-muted [&_a]:font-medium [&_a]:text-accent [&_strong]:font-semibold [&_strong]:text-foreground">
      {children}
    </ul>
  );
}

export function LegalNav() {
  const link = "font-medium text-muted transition-colors hover:text-foreground";
  return (
    <nav className="mb-8 flex items-center gap-2 text-[13.5px]">
      <Link className={link} href="/legal/terms">
        Terms
      </Link>
      <span aria-hidden className="text-muted/60">
        ·
      </span>
      <Link className={link} href="/legal/privacy">
        Privacy
      </Link>
      <span aria-hidden className="text-muted/60">
        ·
      </span>
      <Link className={link} href="/legal/risks">
        Risks
      </Link>
    </nav>
  );
}
