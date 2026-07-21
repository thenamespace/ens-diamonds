"use client";

import { useState } from "react";
import { Alert, Button, Card, Input, Label, TextArea } from "@thenamespace/uikit";

export default function FeedbackPage() {
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3) return;
    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: message.trim(), contact: contact.trim() }),
      });
      if (!res.ok) throw new Error("failed");
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="wrap">
      <div className="mx-auto max-w-[560px]">
        <div className="page-head">
          <div>
            <h1>Feedback</h1>
            <p>Found a bug, missing a feature, or something felt off? Tell us. We read everything.</p>
          </div>
        </div>

        {state === "sent" ? (
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Thanks, got it!</Alert.Title>
              <Alert.Description>
                Your feedback is in. If you left a contact, we&rsquo;ll reach out when there&rsquo;s news.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : (
          <Card>
            <Card.Content>
              <form className="flex flex-col gap-4" onSubmit={submit}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="feedback-message">What&rsquo;s on your mind?</Label>
                  <TextArea
                    id="feedback-message"
                    required
                    minLength={3}
                    maxLength={2000}
                    rows={5}
                    placeholder="The more specific, the better."
                    value={message}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="feedback-contact">How can we reach you? (optional)</Label>
                  <Input
                    id="feedback-contact"
                    maxLength={200}
                    placeholder="email, X handle, ENS name…"
                    value={contact}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContact(e.target.value)}
                  />
                </div>
                {state === "error" && (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>Couldn&rsquo;t send that. Give it a moment and try again.</Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}
                <Button
                  fullWidth
                  type="submit"
                  variant="primary"
                  isDisabled={state === "sending" || message.trim().length < 3}
                >
                  {state === "sending" ? "Sending…" : "Send feedback"}
                </Button>
              </form>
            </Card.Content>
          </Card>
        )}
      </div>
    </div>
  );
}
