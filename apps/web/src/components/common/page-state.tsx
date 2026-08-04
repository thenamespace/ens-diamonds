import type { ReactNode } from "react";

import NextLink from "next/link";

import {
  buttonVariants,
  EmptyState,
  EmptyStateContent,
  EmptyStateDescription,
  EmptyStateHeader,
  EmptyStateMedia,
  Spinner,
  Typography,
} from "@thenamespace/uikit";
import { Diamond02Icon, HugeiconsIcon } from "@thenamespace/uikit/icons";

type PageStateProps = {
  children?: ReactNode;
  description?: string;
  isLoading?: boolean;
  title: string;
};

export const PageState = ({ children, description, isLoading = false, title }: PageStateProps) => (
  <main className="flex min-h-[60vh] items-center justify-center px-4 py-16">
    {isLoading ? (
      <Spinner aria-label={title} />
    ) : (
      <EmptyState size="lg">
        <EmptyStateHeader>
          <EmptyStateMedia variant="icon">
            <HugeiconsIcon aria-hidden icon={Diamond02Icon} strokeWidth={1.5} width={22} />
          </EmptyStateMedia>
          <Typography.Heading className="empty-state__title text-balance" level={1}>
            {title}
          </Typography.Heading>
          {description ? <EmptyStateDescription>{description}</EmptyStateDescription> : null}
        </EmptyStateHeader>
        {children ? <EmptyStateContent>{children}</EmptyStateContent> : null}
      </EmptyState>
    )}
  </main>
);

export const HomeAction = ({
  href = "/",
  label = "Back to Discover",
}: {
  href?: string;
  label?: string;
}) => (
  <NextLink className={buttonVariants({ size: "sm", variant: "primary" })} href={href}>
    {label}
  </NextLink>
);
