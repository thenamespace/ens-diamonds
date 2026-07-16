"use client";

import { useRouter } from "next/navigation";
import { SearchField } from "@thenamespace/uikit";

// Controlled search input. Typing filters the feed live (via `onChange`);
// pressing Enter opens the exact name's page — so you can look up ANY name,
// including ones not currently loaded / not in premium.
export default function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const router = useRouter();

  function go(v: string) {
    const label = v.trim().toLowerCase().replace(/\.eth$/, "");
    if (label.length >= 2) router.push(`/name/${encodeURIComponent(label)}`);
  }

  return (
    <SearchField aria-label="Search ENS names" className="min-w-0 grow sm:grow-0" value={value} onChange={onChange} onSubmit={go}>
      {/* Fixed width on desktop; shrinks with the viewport on small screens. */}
      <SearchField.Group className="w-full min-w-0 rounded-full sm:min-w-[230px]">
        <SearchField.SearchIcon />
        <SearchField.Input placeholder="Search any name…" spellCheck={false} />
        <span className="text-muted pr-3.5 font-mono text-[13px]">.eth</span>
      </SearchField.Group>
    </SearchField>
  );
}
