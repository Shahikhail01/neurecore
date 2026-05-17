import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">NeureCore Tenant Portal</h1>
      <p className="text-gray-500 text-lg">Your AI-powered workspace</p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-100 transition"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}
