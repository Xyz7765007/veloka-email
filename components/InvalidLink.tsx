import { Background } from "@/components/Background";
import { Wordmark } from "@/components/Wordmark";
import { BRAND } from "@/lib/brand";

export function InvalidLink() {
  return (
    <main className="relative min-h-screen">
      <Background />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col px-6 py-7">
        <header className="flex items-center justify-between">
          <Wordmark small />
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-bone-faint">
            invalid link
          </span>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="font-display text-2xl tracking-tight text-bone">
            This link isn&rsquo;t active
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-bone-dim">
            The scoring link you used is invalid or has been turned off. If you
            were sent this by {BRAND.company}, reply to that email and we&rsquo;ll
            send a fresh one.
          </p>
          <a
            href={BRAND.site}
            target="_blank"
            rel="noopener noreferrer"
            className="focusable mt-7 inline-flex items-center gap-2 rounded-full border border-bone/15 px-5 py-2.5 font-mono text-[0.74rem] uppercase tracking-[0.14em] text-bone-dim transition-colors hover:border-bone/35 hover:text-bone"
          >
            Visit {BRAND.company}
          </a>
        </div>
      </div>
    </main>
  );
}
