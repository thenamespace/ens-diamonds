import type { ComponentProps } from "react";

import { Typography } from "@thenamespace/uikit";

type CardHeadingProps = Omit<ComponentProps<typeof Typography.Heading>, "level"> & {
  level?: 2 | 3;
};

export const CardHeading = ({ className = "", level = 2, ...props }: CardHeadingProps) => (
  <Typography.Heading className={`text-base font-semibold ${className}`} level={level} {...props} />
);
