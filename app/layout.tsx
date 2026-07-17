import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cultiva",
  description: "Mente sana en cuerpo sano.",
  icons: {
    icon: [
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cultiva",
  },
};

export const viewport: Viewport = {
  themeColor: "#2B7073",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Link
          href="/"
          aria-label="Ir al inicio de Cultiva"
          className="fixed right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-50 block h-16 w-16 overflow-hidden rounded-xl border border-brand-200 bg-background p-1.5 shadow-sm sm:h-20 sm:w-20"
        >
          <Image
            src="/icons/icon-512x512.png"
            alt="Cultiva"
            width={512}
            height={512}
            priority
            unoptimized
            className="h-full w-full object-cover object-top"
          />
        </Link>
        {children}
      </body>
    </html>
  );
}
