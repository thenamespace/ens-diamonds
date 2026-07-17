"use client";

// uikit compound components (EmptyState.Header, Alert.Indicator, ...) are
// client components. When a SERVER component renders them, the dot-notation
// subcomponents resolve to undefined on the client reference and React throws
// #130 (invalid element type) at render time — which is exactly what took
// down /favourites (signed in, zero favourites) and /name/<invalid>. These
// thin client wrappers keep the compound API inside a client module so server
// pages can use them safely.

import type { ReactNode } from "react";
import { Alert } from "@thenamespace/uikit/alert";
import { EmptyState } from "@thenamespace/uikit/empty-state";

export function EmptyStateCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <EmptyState size="lg">
      <EmptyState.Header>
        <EmptyState.Title>{title}</EmptyState.Title>
        <EmptyState.Description>{description}</EmptyState.Description>
      </EmptyState.Header>
      {children ? <EmptyState.Content>{children}</EmptyState.Content> : null}
    </EmptyState>
  );
}

export function WarningAlert({ children }: { children: ReactNode }) {
  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
