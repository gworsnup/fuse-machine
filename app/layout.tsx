import type { Metadata, Viewport } from "next";

import "./globals.css";
import PwaRegistration from "./PwaRegistration";

export const metadata: Metadata = {
  title: "Roll a Meme",
  description: "Roll rare memes, build passive income, fuse characters and rebirth.",
  applicationName: "Roll a Meme",
  manifest: "/meme-rng.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Roll a Meme",
  },
  icons: {
    icon: [
      { url: "/icons/meme-rng-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/meme-rng-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/meme-rng-apple-touch.png",
  },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#a9432f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
