"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Plus, Copy, CheckCheck, Loader2, RefreshCw, LinkIcon, Users } from "lucide-react";

interface ClientRow {
  slug: string;
  name: string;
  email?: string;
  company?: string;
  quota: number;
  used: number;
  remaining: number;
  scans: number;
  status: string;
  url: string;
}

function Copyable({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className="focusable inline-flex items-center gap-1.5 rounded-lg border border-bone/12 bg-ink-2 px-2.5 py-1.5 font-mono text-[0.68rem] text-bone-dim transition-colors hover:border-brand/40 hover:text-bone"
      title={text}
    >
      {done ? <CheckCheck size={12} className="text-good" /> : <Copy size={12} />}
      {label || (done ? "Copied" : "Copy")}
    </button>
  );
}

function StatusDot({ status, remaining }: { status: string; remaining: number }) {
  const exhausted = status === "exhausted" || remaining <= 0;
  const disabled = status === "disabled";
  const color = disabled ? "bg-bone-faint" : exhausted ? "bg-crit" : "bg-good";
  const label = disabled ? "disabled" : exhausted ? "exhausted" : "active";
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-bone-dim">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export function LinkManager({ onClose }: { onClose: () => void }) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [quota, setQuota] = useState(3);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [justCreated, setJustCreated] = useState<{ name: string; url: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const res = await fetch("/api/clients", { method: "GET" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) {
        setClients(json.clients || []);
      } else {
        setListError(json?.error || "Couldn't load client links.");
      }
    } catch {
      setListError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setCreateError("");
    setJustCreated(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, quota }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) {
        setJustCreated({ name: json.client.name, url: json.client.url });
        setName("");
        setEmail("");
        setCompany("");
        setQuota(3);
        load();
      } else {
        setCreateError(json?.error || "Couldn't create the link.");
      }
    } catch {
      setCreateError("Couldn't reach the server.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 backdrop-blur-sm sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="panel w-full max-w-2xl"
      >
        <div className="flex items-center justify-between border-b border-bone/8 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <LinkIcon size={16} className="text-brand" />
            <h2 className="font-display text-lg tracking-tight text-bone">Client links</h2>
          </div>
          <button onClick={onClose} className="focusable rounded-full p-1.5 text-bone-dim transition-colors hover:bg-ink-2 hover:text-bone">
            <X size={18} />
          </button>
        </div>

        {/* create */}
        <div className="border-b border-bone/8 p-6">
          <div className="mb-3 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-bone-faint">
            Create a link
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client / lead name *" className="focusable col-span-2 rounded-xl border border-bone/12 bg-ink-2 px-3.5 py-2.5 text-sm text-bone placeholder:text-bone-faint hover:border-bone/20" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="focusable rounded-xl border border-bone/12 bg-ink-2 px-3.5 py-2.5 text-sm text-bone placeholder:text-bone-faint hover:border-bone/20" />
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company (optional)" className="focusable rounded-xl border border-bone/12 bg-ink-2 px-3.5 py-2.5 text-sm text-bone placeholder:text-bone-faint hover:border-bone/20" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone-dim">
              Email cap
              <input type="number" min={1} max={50} value={quota} onChange={(e) => setQuota(Math.max(1, Math.min(50, parseInt(e.target.value) || 3)))} className="focusable w-16 rounded-lg border border-bone/12 bg-ink-2 px-2.5 py-1.5 text-center text-sm text-bone" />
            </label>
            <button onClick={create} disabled={creating || !name.trim()} className="focusable inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-white transition-transform hover:scale-[1.02] disabled:opacity-40">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create link
            </button>
          </div>
          {createError && <p className="mt-2.5 text-[0.8rem] text-crit">{createError}</p>}
          {justCreated && (
            <div className="mt-4 rounded-xl border border-brand/30 bg-brand/[0.06] p-4">
              <div className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-brand">
                Link for {justCreated.name}
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-ink-2 px-3 py-2 font-mono text-[0.78rem] text-bone">
                  {justCreated.url}
                </code>
                <Copyable text={justCreated.url} label="Copy link" />
              </div>
            </div>
          )}
        </div>

        {/* list */}
        <div className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-bone-faint">
              <Users size={13} /> {clients.length} {clients.length === 1 ? "client" : "clients"}
            </div>
            <button onClick={load} className="focusable inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-bone-dim transition-colors hover:text-bone">
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {loading && clients.length === 0 && (
            <p className="py-6 text-center text-sm text-bone-faint">Loading…</p>
          )}
          {listError && <p className="py-2 text-[0.82rem] text-crit">{listError}</p>}
          {!loading && !listError && clients.length === 0 && (
            <p className="py-6 text-center text-sm text-bone-faint">
              No client links yet. Create one above.
            </p>
          )}

          <div className="space-y-2.5">
            {clients.map((c) => (
              <div key={c.slug} className="flex items-center justify-between gap-3 rounded-xl border border-bone/8 bg-ink-2/60 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="truncate text-sm font-medium text-bone">{c.name}</span>
                    <StatusDot status={c.status} remaining={c.remaining} />
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[0.7rem] text-bone-faint">
                    {c.url.replace(/^https?:\/\//, "")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <div className="font-mono text-sm text-bone">
                      {c.used}<span className="text-bone-faint">/{c.quota}</span>
                    </div>
                    <div className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-bone-faint">
                      used
                    </div>
                  </div>
                  <Copyable text={c.url} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
