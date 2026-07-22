"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { currency } from "@/lib/utils";

type SearchResult = {
  products: Array<{ _id: string; productName: string; sku: string }>;
  customers: Array<{ _id: string; name: string; phone: string }>;
  suppliers: Array<{ _id: string; supplierName: string }>;
  sales: Array<{ _id: string; invoiceNumber: string; grandTotal: number }>;
  users: Array<{ _id: string; name: string; email: string }>;
};

const empty: SearchResult = { products: [], customers: [], suppliers: [], sales: [], users: [] };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult>(empty);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setResults(empty);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as SearchResult;
      setResults(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void runSearch(q), 250);
    return () => clearTimeout(t);
  }, [q, runSearch]);

  const hasResults =
    results.products.length + results.customers.length + results.suppliers.length + results.sales.length + results.users.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-emerald-50/80 transition hover:bg-white/10 md:flex"
      >
        <Search className="h-4 w-4" />
        Search
        <kbd className="rounded bg-white/10 px-1.5 text-xs">Ctrl+K</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Global search" description="Search products, customers, vendors, invoices, and users.">
          <Input autoFocus placeholder="Type to search..." value={q} onChange={(e) => setQ(e.target.value)} className="mb-4" />
          {loading ? <p className="text-sm text-zinc-500">Searching...</p> : null}
          {!loading && q.length >= 2 && !hasResults ? <p className="text-sm text-zinc-500">No results found.</p> : null}
          <div className="max-h-80 space-y-4 overflow-y-auto text-sm">
            {results.products.length > 0 ? (
              <section>
                <p className="mb-2 font-semibold text-zinc-700">Products</p>
                {results.products.map((p) => (
                  <Link key={p._id} href="/inventory" onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 hover:bg-emerald-50">
                    {p.productName} <span className="text-zinc-500">({p.sku})</span>
                  </Link>
                ))}
              </section>
            ) : null}
            {results.customers.length > 0 ? (
              <section>
                <p className="mb-2 font-semibold text-zinc-700">Customers</p>
                {results.customers.map((c) => (
                  <Link key={c._id} href="/customers" onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 hover:bg-emerald-50">
                    {c.name} · {c.phone}
                  </Link>
                ))}
              </section>
            ) : null}
            {results.suppliers.length > 0 ? (
              <section>
                <p className="mb-2 font-semibold text-zinc-700">Vendors</p>
                {results.suppliers.map((v) => (
                  <Link key={v._id} href="/vendors" onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 hover:bg-emerald-50">
                    {v.supplierName}
                  </Link>
                ))}
              </section>
            ) : null}
            {results.sales.length > 0 ? (
              <section>
                <p className="mb-2 font-semibold text-zinc-700">Invoices</p>
                {results.sales.map((s) => (
                  <Link key={s._id} href="/sales" onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 hover:bg-emerald-50">
                    {s.invoiceNumber} · {currency(s.grandTotal)}
                  </Link>
                ))}
              </section>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
