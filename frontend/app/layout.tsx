import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skyline Project & Engineers Pvt. Ltd. | Maintenance & Safety System",
  description: "Skyline Project & Engineers Pvt. Ltd. — Maintenance & Safety Management System",
  // app/icon.png (the Skyline logo) is picked up automatically as the tab icon.
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* The logo as a faint background watermark on every page. */}
        <div className="watermark" aria-hidden="true" />
      </body>
    </html>
  );
}
