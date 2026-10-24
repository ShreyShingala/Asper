import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-poppins", display: "swap" });

export const metadata: Metadata = {
  title: "MoldFlow · Mold Busters",
  description: "From first concern to verified quote: one evidence-linked case.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FF4D2D", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
