// src/app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between p-4 border-b">
        <div className="font-semibold">Dots CRM</div>
        <nav className="space-x-2">
          <Link href="/demo" className="px-3 py-1 rounded border">View demo</Link>
          <Link href="/login" className="px-3 py-1 rounded bg-black text-white">Sign in</Link>
        </nav>
      </header>

      <section className="flex-1 flex items-center justify-center text-center px-6">
        <div>
          <h1 className="text-4xl font-bold mb-3">A fast, simple CRM</h1>
          <p className="text-muted-foreground mb-6">
            Bulk upload contacts, annotate activity, and stay on top of deals.
          </p>
          <div className="space-x-2">
            <Link href="/demo" className="px-4 py-2 rounded border">View demo</Link>
            <Link href="/login" className="px-4 py-2 rounded bg-black text-white">Sign up</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
