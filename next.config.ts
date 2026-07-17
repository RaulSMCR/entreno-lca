import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const nextConfig: NextConfig = {
  /* config options here */
};

function publicRevision(pathname: string): string {
  const filePath = join(process.cwd(), "public", pathname.replace(/^\//, ""));
  return createHash("md5").update(readFileSync(filePath)).digest("hex");
}

const buildRevision =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  String(Date.now());

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [
    { url: "/", revision: buildRevision },
    { url: "/manifest.webmanifest", revision: buildRevision },
    { url: "/CULTIVA_icono_app.svg", revision: publicRevision("/CULTIVA_icono_app.svg") },
    { url: "/icons/icon-192x192.png?v=cultiva-icono", revision: publicRevision("/icons/icon-192x192.png") },
    { url: "/icons/icon-512x512.png?v=cultiva-icono", revision: publicRevision("/icons/icon-512x512.png") },
    { url: "/icons/icon-maskable-512x512.png?v=cultiva-icono", revision: publicRevision("/icons/icon-maskable-512x512.png") },
    { url: "/icons/apple-touch-icon.png?v=cultiva-icono", revision: publicRevision("/icons/apple-touch-icon.png") },
    { url: "/icons/cultiva-logo-512.png?v=cultiva-logo", revision: publicRevision("/icons/cultiva-logo-512.png") },
  ],
});

export default withSerwist(nextConfig);
