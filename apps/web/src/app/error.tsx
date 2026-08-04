"use client";

import { useCallback } from "react";

import { Button } from "@thenamespace/uikit";

import { HomeAction, PageState } from "@/components/common";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  const retry = useCallback(() => reset(), [reset]);

  return (
    <PageState
      description="The page could not be loaded. Check your connection, then try again."
      title="Something Went Wrong"
    >
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" onPress={retry}>
          Try Again
        </Button>
        <HomeAction />
      </div>
    </PageState>
  );
}
