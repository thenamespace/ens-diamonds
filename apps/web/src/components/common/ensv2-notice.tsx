"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ArrowUpRight01Icon,
  Cancel01Icon,
  HugeiconsIcon,
  InformationCircleIcon,
} from "@thenamespace/uikit/icons";

const DISMISS_KEY = "ensv2-notice-dismissed";
const ENSV2_LAUNCH_URL = "https://ens.domains/blog/post/ensv2-live-on-mainnet";

export const Ensv2Notice = () => {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISS_KEY) === "1") setIsDismissed(true);
  }, []);

  const dismiss = useCallback(() => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setIsDismissed(true);
  }, []);

  if (isDismissed) return null;

  return (
    <aside
      aria-label="ENS v2 notice"
      className="border-b border-amber-300 bg-amber-100 text-amber-950"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <HugeiconsIcon
          aria-hidden
          className="hidden size-4 shrink-0 sm:block"
          icon={InformationCircleIcon}
        />
        <p className="flex-1 text-sm leading-snug">
          <span className="font-semibold">ENS v2 is live.</span>{" "}
          <span className="text-amber-900">
            ens.diamonds still runs on the original ENS contracts. We&apos;re working on v2 support.
          </span>{" "}
          <a
            className="inline-flex items-center gap-0.5 font-semibold whitespace-nowrap underline underline-offset-4 decoration-amber-950/40 hover:decoration-amber-950"
            href={ENSV2_LAUNCH_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            What&apos;s new in v2
            <HugeiconsIcon aria-hidden className="size-3.5" icon={ArrowUpRight01Icon} />
          </a>
        </p>
        <button
          aria-label="Dismiss notice"
          className="-mr-1.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full transition-colors text-amber-900 hover:bg-amber-200 hover:text-amber-950"
          onClick={dismiss}
          type="button"
        >
          <HugeiconsIcon aria-hidden className="size-4" icon={Cancel01Icon} />
        </button>
      </div>
    </aside>
  );
};
