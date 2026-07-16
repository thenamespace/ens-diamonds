"use client";

import { useState } from "react";
import { Button, Input, Link as UiLink, Modal } from "@thenamespace/uikit";

// Opens a share modal for inviting people to a pool: copy the link or post to X.
export default function ShareButton({ name, className }: { name?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? window.location.href : "";
  const text = name ? `Join my ens.diamonds vault to buy ${name}.eth together` : "Join my ens.diamonds vault";
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
    <Modal>
      <Button className={className} variant="secondary">
        Share invite ↗
      </Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog aria-label="Share vault">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Invite people to this vault</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-muted text-sm">
                Anyone you invited onchain can open this link, review the vault, and deposit their share.
              </p>

              <div className="mt-3 flex items-center gap-2">
                <Input aria-label="Vault link" className="flex-1 font-mono text-xs" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
                <Button size="sm" onPress={copy}>
                  {copied ? "Copied ✓" : "Copy"}
                </Button>
              </div>

              <UiLink
                className="mt-4 flex items-center justify-center gap-2"
                href={xHref}
                rel="noreferrer"
                target="_blank"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M18.9 1.6h3.5l-7.6 8.7 9 11.9h-7l-5.5-7.2-6.3 7.2H1.5l8.2-9.3L1 1.6h7.2l5 6.6zm-1.2 18.4h1.9L6.4 3.6H4.3z" />
                </svg>
                Share on X
              </UiLink>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
