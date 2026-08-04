import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f7f7f7",
    description: siteConfig.description,
    display: "standalone",
    icons: [
      {
        sizes: "500x500",
        src: "/icon.png",
        type: "image/png",
      },
      {
        sizes: "180x180",
        src: "/apple-icon.png",
        type: "image/png",
      },
    ],
    name: siteConfig.name,
    short_name: siteConfig.name,
    start_url: "/",
    theme_color: "#f7f7f7",
  };
}
