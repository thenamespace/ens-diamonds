import type { ComponentProps } from "react";

import { NumberValue } from "@thenamespace/uikit";

import { weiToEth } from "@/lib/helpers";

type EthValueProps = Omit<ComponentProps<typeof NumberValue>, "value"> & {
  value: bigint;
};

export const EthValue = ({ value, ...props }: EthValueProps) => (
  <NumberValue maximumFractionDigits={6} value={weiToEth(value)} {...props}>
    <NumberValue.Suffix className="ml-1 text-xs text-muted">ETH</NumberValue.Suffix>
  </NumberValue>
);
