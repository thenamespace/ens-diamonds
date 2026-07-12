"use client";

import { useRouter } from "next/navigation";

// Controlled search input. Typing filters the feed live (via `onChange`);
// pressing Enter opens the exact name's page — so you can look up ANY name,
// including ones not currently loaded / not in premium.
export default function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const router = useRouter();

  function go(e: React.FormEvent) {
    e.preventDefault();
    const label = value.trim().toLowerCase().replace(/\.eth$/, "");
    if (label.length >= 2) router.push(`/name/${encodeURIComponent(label)}`);
  }

  return (
    <form className="search" onSubmit={go}>
      <button type="submit" className="search-go" aria-label="Search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
      </button>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search any name…"
        aria-label="Search ENS names"
        spellCheck={false}
      />
      <span className="search-eth">.eth</span>
    </form>
  );
}
