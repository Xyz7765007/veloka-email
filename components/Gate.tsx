"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import { Background } from "@/components/Background";
import { Wordmark } from "@/components/Wordmark";

export function Gate({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) {
        router.refresh();
      } else {
        setError(json?.error || "Incorrect password.");
        setBusy(false);
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
      setBusy(false);
    }
  };

  return (
    <main className="relative min-h-screen">
      <Background />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-6 py-7">
        <header className="flex items-center justify-between">
          <Wordmark small />
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-bone-faint">
            internal
          </span>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="grid h-16 w-16 place-items-center rounded-2xl border border-brand/30 bg-brand/10 text-brand"
          >
            <Lock size={26} />
          </motion.div>
          <h1 className="mt-6 font-display text-2xl tracking-tight text-bone">
            Team access
          </h1>
          <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-bone-dim">
            This is the internal scorer. Enter the password to continue, or use a
            client link to score with a quota.
          </p>

          {!configured && (
            <p className="mt-5 w-full rounded-xl border border-crit/30 bg-crit/5 px-4 py-3 text-center text-[0.78rem] leading-relaxed text-crit">
              Access isn&rsquo;t configured. Set <span className="font-mono">ACCESS_PASSWORD</span> in
              the environment and redeploy.
            </p>
          )}

          <div className="mt-7 w-full">
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={password}
                autoFocus
                disabled={!configured || busy}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="Password"
                className="focusable w-full rounded-xl border border-bone/12 bg-ink-2 px-4 py-3 text-bone placeholder:text-bone-faint transition-colors hover:border-bone/20"
              />
              <button
                onClick={submit}
                disabled={!configured || busy || !password}
                className="focusable grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl bg-brand text-white transition-transform hover:scale-[1.03] disabled:opacity-40"
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              </button>
            </div>
            {error && (
              <p className="mt-2.5 text-center text-[0.8rem] text-crit">{error}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
