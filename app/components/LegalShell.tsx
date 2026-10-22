import type { ReactNode } from "react";
import Link from "next/link";

const links = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/data-deletion", label: "Data Deletion" },
];

export default function LegalShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800 sm:px-6">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-6 py-7 sm:px-10">
          <Link href="/" className="text-sm font-semibold tracking-wide text-indigo-700 hover:text-indigo-900">
            Tynato CRM
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p> : null}
        </header>
        <div className="space-y-5 px-6 py-7 text-sm leading-7 sm:px-10 sm:py-9 [&_h2]:pt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-950 [&_a]:font-medium [&_a]:text-indigo-700 [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-indigo-900 [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal">
          {children}
        </div>
        <footer className="border-t border-slate-200 bg-slate-50 px-6 py-6 sm:px-10">
          <nav aria-label="Legal pages" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-slate-600 underline underline-offset-4 hover:text-indigo-700">
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Tynato CRM · Contact: <a href="mailto:support@tynato.com">support@tynato.com</a>
          </p>
          <p className="mt-2 text-xs leading-5 text-amber-800">
            Before publishing, replace any marked business-detail placeholders and verify that all statements reflect the live service.
          </p>
        </footer>
      </article>
    </main>
  );
}
