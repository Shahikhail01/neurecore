import type { Metadata } from "next";
import { AppProvider } from "@/application/AppProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeureCore Dashboard",
  description: "AI Agent Management Platform",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
