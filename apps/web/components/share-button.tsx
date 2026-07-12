"use client";

import { useState } from "react";

// Opens a share modal for inviting people to a pool: copy the link or post to X.
export default function ShareButton({ name, className }: { name?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? window.location.href : "";
  const text = name ? `Join my Coffer pool to buy ${name}.eth together` : "Join my Coffer pool";
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <>
      <button type="button" className={`btn btn-soft${className ? ` ${className}` : ""}`} onClick={() => setOpen(true)}>
        Share invite ↗
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)} role="presentation">
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Share pool">
            <div className="modal-head">
              <h3>Invite people to this pool</h3>
              <button className="modal-x" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <p className="muted" style={{ fontSize: 14, marginTop: -4 }}>
              Anyone you invited on-chain can open this link, review the pool, and deposit their share.
            </p>

            <div className="share-url">
              <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Pool link" />
              <button className="btn btn-primary btn-sm" onClick={copy}>
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>

            <a className="btn btn-soft btn-block mt-8" href={xHref} target="_blank" rel="noreferrer">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ marginRight: 8, verticalAlign: "-2px" }}>
                <path d="M18.9 1.6h3.5l-7.6 8.7 9 11.9h-7l-5.5-7.2-6.3 7.2H1.5l8.2-9.3L1 1.6h7.2l5 6.6zm-1.2 18.4h1.9L6.4 3.6H4.3z" />
              </svg>
              Share on X
            </a>
          </div>
        </div>
      )}
    </>
  );
}
