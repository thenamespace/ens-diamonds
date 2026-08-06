"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@thenamespace/uikit";
import { CheckIcon, Copy01Icon, HugeiconsIcon } from "@thenamespace/uikit/icons";
import { useCopyToClipboard } from "usehooks-ts";

interface CopyButtonProps {
  className?: string;
  label: string;
  value: string;
}

export const CopyButton = ({ className = "", label, value }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);
  const [, copy] = useCopyToClipboard();
  const handleCopy = useCallback(async () => {
    if (await copy(value)) setCopied(true);
  }, [copy, value]);

  useEffect(() => {
    if (!copied) return;

    const timeout = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <Button
      aria-label={label}
      className={className}
      isIconOnly
      size="sm"
      variant="ghost"
      onPress={handleCopy}
    >
      <HugeiconsIcon className="size-3.5" icon={copied ? CheckIcon : Copy01Icon} />
    </Button>
  );
};
