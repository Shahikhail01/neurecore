/**
 * Not Found Page
 * 404 error page
 */

"use client";

import { Result, Button } from "antd";
import { useRouter } from "next/navigation";

export default function NotFoundPage() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Result
        status="404"
        title="Page Not Found"
        subTitle="The page you're looking for doesn't exist or has been removed."
        extra={
          <div className="flex gap-3">
            <Button type="primary" onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </Button>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
        }
      />
    </div>
  );
}
