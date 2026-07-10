"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const label = q.trim().toLowerCase().replace(/\.eth$/, "");
    if (label.length >= 2) router.push(`/name/${encodeURIComponent(label)}`);
  }

  return (
    <form className="search" onSubmit={go}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
      </svg>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search any name…"
        aria-label="Search ENS names"
        spellCheck={false}
      />
      <span className="search-eth">.eth</span>
    </form>
  );
}
