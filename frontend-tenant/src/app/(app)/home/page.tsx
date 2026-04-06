"use client";

import { HomeScreen } from "@/components/home/HomeScreen";
import { useRouter } from "next/navigation";

/**
 * Home page inside (app) layout — renders the Creatio-inspired HomeScreen
 * with the AppShell sidebar. Real data from stores.
 */
export default function HomePage() {
  const router = useRouter();
  return (
    <HomeScreen
      onCommandSubmit={(cmd) =>
        router.push(`/tasks/new?q=${encodeURIComponent(cmd)}`)
      }
    />
  );
}
