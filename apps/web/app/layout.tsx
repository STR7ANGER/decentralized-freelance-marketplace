import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./styles.css";

export const metadata: Metadata = {
  title: "Proofwork",
  description: "Milestone-based freelance work with transparent Solana escrow.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
