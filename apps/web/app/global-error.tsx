"use client";

// Root error boundary — catches crashes above the route level (layout,
// providers). Must render its own <html>/<body> since the root layout may be
// the thing that failed; keep it dependency-free for maximum survivability.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error(error);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#5a6478", marginBottom: 20 }}>
            ens.diamonds hit an unexpected error. Your funds and vaults are unaffected.
          </p>
          <button
            style={{ padding: "10px 22px", borderRadius: 999, border: "1px solid #d4dae6", background: "#12151c", color: "#fff", fontSize: 15, cursor: "pointer" }}
            onClick={() => reset()}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
