import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cultiva",
    short_name: "Cultiva",
    description: "Mente sana en cuerpo sano.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6EFDF",
    theme_color: "#2B7073",
    icons: [
      {
        src: "/new-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-192x192.png?v=cultiva",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png?v=cultiva",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512x512.png?v=cultiva",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
