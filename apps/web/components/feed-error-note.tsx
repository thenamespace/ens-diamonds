"use client";

import { Alert } from "@thenamespace/uikit";

// UIKit components are client-side (React Aria); this thin wrapper lets the
// server-rendered Discover page show the load-failure note.
export default function FeedErrorNote({ message }: { message: string }) {
  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{message}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}
