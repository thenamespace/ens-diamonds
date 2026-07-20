import { jsonLdString } from "@/lib/json-ld";

// Server-renderable structured-data script. Builders live in lib/json-ld.ts
// (kept JSX-free so vitest can import them without a JSX transform).
export default function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
