import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignalRoom — Brand Crisis Radar",
  description: "Real-time brand reputation monitoring and crisis prediction",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0e1a] text-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
