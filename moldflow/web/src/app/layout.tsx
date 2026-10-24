import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz", "SOFT"] });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "MoldFlow · Mold Busters",
  description: "From first concern to verified quote: one evidence-linked case.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5f1e8" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plex.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
