import { serializeJsonLd } from "@/lib/seo";

interface JsonLdProps {
  data: object;
}

export const JsonLd = ({ data }: JsonLdProps) => (
  <script type="application/ld+json">{serializeJsonLd(data)}</script>
);
