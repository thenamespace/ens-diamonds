import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { namehash } from "viem";
import { getPool, sepoliaClient } from "@/lib/sepolia-client";
import { ENS_REGISTRY, ensRegistryAbi } from "@/lib/ens-registrar";

// Server-side social-card renderer for vault pages. Mirrors the in-app
// registration certificate (ink/cream/gold engraved deed) so a shared vault
// link unfurls into the same artifact people see in the app. Used by both
// opengraph-image.tsx and twitter-image.tsx under app/vaults/[id]/.

export const OG_SIZE = { width: 1200, height: 630 };

const INK = "#141827";
const GOLD = "#c8a45c";
const BLUE = "#7d9fff";

const cream = (alpha: number) => `rgba(240, 234, 217, ${alpha})`;

// The satori renderer needs raw font data; these files ship with the app (see
// outputFileTracingIncludes in next.config.mjs).
async function loadFonts() {
  const dir = path.join(process.cwd(), "assets", "fonts");
  const [fraunces, frauncesItalic, mono] = await Promise.all([
    readFile(path.join(dir, "fraunces-500.ttf")),
    readFile(path.join(dir, "fraunces-500-italic.ttf")),
    readFile(path.join(dir, "jetbrains-mono-600.ttf")),
  ]);
  return [
    { name: "Fraunces", data: fraunces, weight: 500 as const, style: "normal" as const },
    { name: "Fraunces", data: frauncesItalic, weight: 500 as const, style: "italic" as const },
    { name: "JetBrains Mono", data: mono, weight: 600 as const, style: "normal" as const },
  ];
}

async function isRegisteredToSafe(label: string, safe: string): Promise<boolean> {
  if (!label || !safe) return false;
  try {
    const owner = (await sepoliaClient.readContract({
      address: ENS_REGISTRY,
      abi: ensRegistryAbi,
      functionName: "owner",
      args: [namehash(`${label}.eth`)],
    })) as string;
    return owner.toLowerCase() === safe.toLowerCase();
  } catch {
    return false;
  }
}

function CornerDiamond({ position }: { position: { top?: number; bottom?: number; left?: number; right?: number } }) {
  return (
    <div
      style={{
        position: "absolute",
        width: 12,
        height: 12,
        transform: "rotate(45deg)",
        backgroundColor: GOLD,
        ...position,
      }}
    />
  );
}

export async function renderVaultCard(idRaw: string): Promise<ImageResponse> {
  const id = Number.parseInt(idRaw, 10);
  const pool = Number.isInteger(id) && id >= 0 ? await getPool(id) : null;
  const label = pool?.label ?? "";
  const registered = pool ? await isRegisteredToSafe(pool.label, pool.safe) : false;

  const eyebrow = registered ? "Registration Complete" : pool ? `ens.diamonds · vault nº ${id}` : "ens.diamonds";
  const name = label || "ens.diamonds";
  const suffix = label ? ".eth" : "";
  const badge = registered ? null : "vault forming";
  const meta = registered
    ? "Bought this name together with frENS."
    : "Pool ETH with frENS to claim this name together.";
  // Scale the wordmark down for long labels so it never clips.
  const nameSize = Math.min(120, Math.max(52, Math.floor(1500 / (name.length + suffix.length + 2))));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 36,
          backgroundColor: INK,
          backgroundImage: "radial-gradient(circle at 50% -20%, #1d2438 0%, #141827 60%)",
          fontFamily: "Fraunces",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            border: `1px solid ${cream(0.14)}`,
            borderRadius: 18,
            padding: 7,
          }}
        >
          <div
            style={{
              flex: 1,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: `1.5px solid ${cream(0.38)}`,
              borderRadius: 12,
              padding: "40px 60px",
            }}
          >
            <CornerDiamond position={{ top: -6, left: -6 }} />
            <CornerDiamond position={{ top: -6, right: -6 }} />
            <CornerDiamond position={{ bottom: -6, left: -6 }} />
            <CornerDiamond position={{ bottom: -6, right: -6 }} />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontFamily: "JetBrains Mono",
                fontSize: 22,
                letterSpacing: 6,
                textTransform: "uppercase",
                color: BLUE,
              }}
            >
              <div style={{ width: 9, height: 9, marginRight: 18, transform: "rotate(45deg)", backgroundColor: BLUE }} />
              {eyebrow}
              <div style={{ width: 9, height: 9, marginLeft: 12, transform: "rotate(45deg)", backgroundColor: BLUE }} />
            </div>

            <svg
              width="86"
              height="79"
              viewBox="0 0 48 44"
              fill="none"
              stroke={cream(1)}
              strokeWidth="1.2"
              strokeLinejoin="round"
              style={{ marginTop: 28 }}
            >
              <path d="M4 15L15 4h18l11 11-20 26z" />
              <path d="M4 15h40M15 4l4 11M33 4l-4 11M19 15l5 26M29 15l-5 26" strokeOpacity="0.65" />
            </svg>

            {registered ? (
              <div style={{ marginTop: 24, fontSize: 40, color: cream(0.92) }}>Congratulations — you now own</div>
            ) : null}

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                marginTop: 6,
                fontSize: nameSize,
                lineHeight: 1.05,
                letterSpacing: -1,
                color: cream(1),
              }}
            >
              <span>{name}</span>
              {suffix ? <span style={{ color: BLUE }}>{suffix}</span> : null}
            </div>

            <div style={{ display: "flex", alignItems: "center", marginTop: 34, width: 460 }}>
              <div
                style={{
                  flex: 1,
                  height: 1.5,
                  backgroundImage: `linear-gradient(to right, rgba(240,234,217,0), ${cream(0.38)})`,
                }}
              />
              <div style={{ width: 10, height: 10, margin: "0 16px", transform: "rotate(45deg)", backgroundColor: GOLD }} />
              <div
                style={{
                  flex: 1,
                  height: 1.5,
                  backgroundImage: `linear-gradient(to left, rgba(240,234,217,0), ${cream(0.38)})`,
                }}
              />
            </div>

            {badge ? (
              <div
                style={{
                  fontFamily: "JetBrains Mono",
                  marginTop: 26,
                  fontSize: 24,
                  letterSpacing: 9,
                  textTransform: "uppercase",
                  color: GOLD,
                }}
              >
                {badge}
              </div>
            ) : null}

            <div style={{ marginTop: 24, fontSize: 28, fontStyle: "italic", color: cream(0.72) }}>{meta}</div>

          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}
