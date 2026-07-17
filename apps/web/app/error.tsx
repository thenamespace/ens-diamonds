"use client";

import { useEffect } from "react";
import { Button, EmptyState } from "@thenamespace/uikit";

// Route-level error boundary: a client exception anywhere in a page tree now
// degrades to this card (with recovery) instead of Next's blank
// "Application error" screen.
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="wrap">
      <EmptyState size="lg">
        <EmptyState.Header>
          <EmptyState.Title>Something went wrong</EmptyState.Title>
          <EmptyState.Description>
            The page hit an unexpected error. Your funds and vaults are unaffected. This is a display problem only.
          </EmptyState.Description>
        </EmptyState.Header>
        <EmptyState.Content>
          <div className="flex gap-2">
            <Button onPress={reset}>Try again</Button>
            <Button variant="outline" onPress={() => window.location.assign("/")}>
              Back to Discover
            </Button>
          </div>
        </EmptyState.Content>
      </EmptyState>
    </div>
  );
}
