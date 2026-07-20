import type { ReactNode } from "react";
import { LegalNav } from "./legal-ui";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="wrap">
      <div className="mx-auto max-w-[760px] pt-6 pb-16">
        <LegalNav />
        {children}
      </div>
    </div>
  );
}
