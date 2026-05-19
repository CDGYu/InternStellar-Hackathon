import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "InternStellar — Chain Bridge",
  description: "Smart remittance escrow on Stellar / Soroban",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
