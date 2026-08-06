import type { ComponentPropsWithoutRef } from "react";

type PageMainProps = ComponentPropsWithoutRef<"main"> & {
  size?: "reading" | "wide";
  spacing?: "default" | "loose";
};

const WIDTHS = {
  reading: "max-w-5xl",
  wide: "max-w-7xl",
} as const;

const SPACING = {
  default: "py-7 sm:py-9",
  loose: "py-12 sm:py-16 lg:py-20",
} as const;

export const PageMain = ({
  children,
  className = "",
  size = "wide",
  spacing = "default",
  ...props
}: PageMainProps) => (
  <main
    className={`mx-auto w-full px-4 sm:px-6 lg:px-8 ${WIDTHS[size]} ${SPACING[spacing]} ${className}`}
    {...props}
  >
    {children}
  </main>
);
