import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight text-white">NeureCore Admin</h1>
      <p className="text-gray-400 text-lg">Super Admin Control Plane</p>
      <Link
        href="/login"
        className="rounded-lg bg-indigo-600 px-6 py-3 text-white font-medium hover:bg-indigo-700 transition"
      >
        Sign In
      </Link>
    </main>
  );
}
