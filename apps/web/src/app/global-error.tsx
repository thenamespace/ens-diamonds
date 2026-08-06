"use client";

import { useCallback } from "react";

import { Button } from "@thenamespace/uikit";

import { HomeAction, PageState } from "@/components/common";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ reset }: GlobalErrorPageProps) {
  const retry = useCallback(() => reset(), [reset]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <PageState
          description="The application could not start correctly. Try again or return to Discover."
          title="ENS Diamonds Is Unavailable"
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" onPress={retry}>
              Try Again
            </Button>
            <HomeAction />
          </div>
        </PageState>
      </body>
    </html>
  );
}
