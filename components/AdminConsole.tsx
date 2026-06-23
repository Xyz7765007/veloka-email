"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LinkIcon, LogOut } from "lucide-react";
import { Coldscore } from "@/components/Coldscore";
import { LinkManager } from "@/components/LinkManager";

export function AdminConsole() {
  const router = useRouter();
  const [showLinks, setShowLinks] = useState(false);

  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" }).catch(() => {});
    router.refresh();
  };

  return (
    <>
      <Coldscore isAdmin />

      {/* floating admin controls */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
        <button
          onClick={logout}
          title="Log out"
          className="focusable grid h-10 w-10 place-items-center rounded-full border border-bone/12 bg-ink-2 text-bone-dim shadow-panel transition-colors hover:text-bone"
        >
          <LogOut size={16} />
        </button>
        <button
          onClick={() => setShowLinks(true)}
          className="focusable inline-flex items-center gap-2 rounded-full border border-bone/12 bg-ink-2 px-4 py-2.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-bone shadow-panel transition-colors hover:border-brand/40"
        >
          <LinkIcon size={15} className="text-brand" />
          Client links
        </button>
      </div>

      {showLinks && <LinkManager onClose={() => setShowLinks(false)} />}
    </>
  );
}
