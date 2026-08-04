"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button, Card, Spinner } from "@thenamespace/uikit";
import {
  ArrowUpRight01Icon,
  Download01Icon,
  HugeiconsIcon,
  NewTwitterIcon,
} from "@thenamespace/uikit/icons";
import confetti from "canvas-confetti";
import { toPng } from "html-to-image";
import type { Address } from "viem";

import { appNetwork } from "@/lib/network";

import styles from "./vault-certificate.module.css";

type VaultCertificateProps = {
  name: string;
  safeAddress: Address;
};

const includeInCertificate = (element: HTMLElement) =>
  !(element instanceof HTMLElement && element.dataset.nocapture !== undefined);

export const VaultCertificate = ({ name, safeAddress }: VaultCertificateProps) => {
  const certificateRef = useRef<HTMLElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const label = name.endsWith(".eth") ? name.slice(0, -4) : name;
  const ensUrl = `https://app.ens.domains/${encodeURIComponent(name)}`;
  const safeUrl = `https://app.safe.global/home?safe=${appNetwork === "mainnet" ? "eth" : "sep"}:${safeAddress}`;
  const shareText = `We pooled up and registered ${name} together 💎\n\nCo-owned by our vault's Safe, via ens.diamonds\nhttps://www.ens.diamonds`;
  const shareUrl = `https://x.com/intent/post?text=${encodeURIComponent(shareText)}`;
  const openEns = useCallback(() => window.open(ensUrl, "_blank", "noopener,noreferrer"), [ensUrl]);
  const openSafe = useCallback(
    () => window.open(safeUrl, "_blank", "noopener,noreferrer"),
    [safeUrl],
  );
  const openShare = useCallback(
    () => window.open(shareUrl, "_blank", "noopener,noreferrer"),
    [shareUrl],
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timeout = window.setTimeout(() => {
      void confetti({
        colors: ["#7d9fff", "#c8a45c", "#f0ead9"],
        disableForReducedMotion: true,
        origin: { y: 0.35 },
        particleCount: 90,
        spread: 75,
        startVelocity: 35,
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, []);

  const downloadCertificate = useCallback(async () => {
    const certificate = certificateRef.current;
    if (!certificate) return;

    setIsDownloading(true);

    try {
      await document.fonts.ready;

      const dataUrl = await toPng(certificate, {
        pixelRatio: 3,
        filter: includeInCertificate,
      });
      const download = document.createElement("a");

      download.download = `${label}-eth-registered.png`;
      download.href = dataUrl;
      download.click();
    } catch {
      // Keep the control available when browser image capture is blocked.
    } finally {
      setIsDownloading(false);
    }
  }, [label]);

  return (
    <Card className="mt-7" variant="default">
      <Card.Content className="flex flex-col items-center gap-5 px-4 py-8 text-center sm:px-8">
        <h2 className="m-0 text-xl tracking-tight">
          <span className="font-semibold">Congrats!</span>{" "}
          <span className="font-normal">
            Tell your friends about your purchase? <span aria-hidden>😎</span>
          </span>
        </h2>

        <figure
          aria-label={`${name} is registered and held by this vault's Safe`}
          className={styles.certificate}
          ref={certificateRef}
        >
          <button
            aria-label="Download the certificate as an image"
            className={styles.save}
            data-nocapture
            disabled={isDownloading}
            onClick={downloadCertificate}
            title="Download as image"
            type="button"
          >
            {isDownloading ? (
              <Spinner color="current" size="sm" />
            ) : (
              <HugeiconsIcon aria-hidden icon={Download01Icon} size={15} strokeWidth={2} />
            )}
          </button>

          <div className={styles.frame}>
            <span aria-hidden className={`${styles.corner} ${styles.topLeft}`}>
              ◆
            </span>
            <span aria-hidden className={`${styles.corner} ${styles.topRight}`}>
              ◆
            </span>
            <span aria-hidden className={`${styles.corner} ${styles.bottomLeft}`}>
              ◆
            </span>
            <span aria-hidden className={`${styles.corner} ${styles.bottomRight}`}>
              ◆
            </span>

            <p className={styles.eyebrow}>
              <span aria-hidden>◆</span>
              Registration Complete
              <span aria-hidden>◆</span>
            </p>
            <svg
              aria-hidden
              className={styles.mark}
              fill="none"
              height="42"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.2"
              viewBox="0 0 48 44"
              width="46"
            >
              <path d="M4 15L15 4h18l11 11-20 26z" />
              <path d="M4 15h40M15 4l4 11M33 4l-4 11M19 15l5 26M29 15l-5 26" strokeOpacity="0.65" />
            </svg>
            <p className={styles.congratulations}>Congratulations — you now own</p>
            <h3 className={styles.name}>
              {label}
              <span>.eth</span>
            </h3>
            <div aria-hidden className={styles.rule}>
              ◆
            </div>
            <p className={styles.meta}>Bought this name together with my frENS.</p>
          </div>
        </figure>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button className="gap-1.5" size="sm" variant="primary" onPress={openEns}>
            View on ENS
            <HugeiconsIcon aria-hidden icon={ArrowUpRight01Icon} strokeWidth={1.5} width={13} />
          </Button>
          <Button className="gap-1.5" size="sm" variant="secondary" onPress={openSafe}>
            View in Safe
            <HugeiconsIcon aria-hidden icon={ArrowUpRight01Icon} strokeWidth={1.5} width={13} />
          </Button>
          <Button className="gap-1.5" size="sm" variant="secondary" onPress={openShare}>
            <HugeiconsIcon aria-hidden icon={NewTwitterIcon} strokeWidth={1.5} width={14} />
            Share
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
};
