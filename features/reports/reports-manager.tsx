"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileBarChart } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, Surface } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currency, percentage } from "@/lib/utils";
import { BlockLoader } from "@/components/ui/loader";
import { exportRowsToPdf } from "@/services/report-export";

const REPORT_TYPES = [
  ["sales", "Sales Report"],
  ["inventory", "Inventory Report"],
  ["profit", "Profit Report"],
  ["credit", "Credit Report"],
  ["tax", "Tax Report"],
] as const;

type ReportType = (typeof REPORT_TYPES)[number][0];

type ReportData = {
  title: string;
  summary: Record<string, string | number>;
  headers: string[];
  rows: Array<Array<string | number>>;
};

export function ReportsManager() {
  const [type, setType] = useState<ReportType>("sales");
  const [start, setStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const report = useQuery({
    queryKey: ["report", type, start, end],
    queryFn: async () => {
      const params = new URLSearchParams({ type });
      if (type !== "inventory" && type !== "credit") {
        params.set("start", start);
        params.set("end", end);
      }
      const response = await fetch(`/api/reports/generate?${params}`);
      if (!response.ok) throw new Error("Unable to generate report");
      return response.json() as Promise<ReportData>;
    },
  });

  const summaryCards = useMemo(() => {
    const summary = report.data?.summary ?? {};
    return Object.entries(summary).map(([key, value]) => ({
      label: key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
      value: typeof value === "number" && (key.includes("revenue") || key.includes("profit") || key.includes("cost") || key.includes("tax") || key.includes("Outstanding") || key.includes("Value") || key.includes("cash") || key.includes("credit") || key.includes("split") || key === "total")
        ? currency(value)
        : key === "margin" ? percentage(Number(value)) : value,
    }));
  }, [report.data?.summary]);

  const exportPdf = () => {
    if (!report.data) return;
    exportRowsToPdf(report.data.title, report.data.headers, report.data.rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Reports</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">Sales, inventory, profit, credit, and tax reports with PDF export.</p>
        </div>
        <Button variant="secondary" onClick={exportPdf} disabled={!report.data}>
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      <Surface>
        <div className="mb-6 flex flex-wrap gap-2">
          {REPORT_TYPES.map(([id, label]) => (
            <Button key={id} size="sm" variant={type === id ? "primary" : "ghost"} onClick={() => setType(id)}>
              {label}
            </Button>
          ))}
        </div>

        {type !== "inventory" && type !== "credit" ? (
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div>
              <Label>Start Date</Label>
              <Input className="mt-1.5" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input className="mt-1.5" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        ) : null}

        {report.isLoading ? (
          <BlockLoader label="Generating report..." />
        ) : report.isError ? (
          <p className="py-12 text-center text-red-500">Unable to load report.</p>
        ) : (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <Card key={card.label}>
                  <p className="text-sm text-zinc-400">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold">{card.value}</p>
                </Card>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-100 dark:bg-zinc-900">
                  <tr>
                    {report.data?.headers.map((header) => (
                      <th key={header} className="px-4 py-3 font-medium">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(report.data?.rows ?? []).length === 0 ? (
                    <tr><td colSpan={report.data?.headers.length ?? 1} className="px-4 py-12 text-center text-zinc-500">No data for this period.</td></tr>
                  ) : (
                    report.data!.rows.map((row, index) => (
                      <tr key={index} className="border-t border-zinc-100 dark:border-zinc-800">
                        {row.map((cell, cellIndex) => {
                          const header = report.data?.headers[cellIndex] ?? "";
                          const isMoney = ["Total", "Cost", "Price", "Balance", "Credit Limit", "Subtotal", "Tax", "Sold At", "Profit"].includes(header);
                          return (
                            <td key={cellIndex} className="px-4 py-3">
                              {typeof cell === "number" && isMoney ? currency(cell) : String(cell)}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Surface>

      <Card className="flex items-center gap-3 p-5">
        <FileBarChart className="h-8 w-8 text-emerald-400" />
        <div>
          <p className="font-medium">Printable Reports</p>
          <p className="text-sm text-zinc-500">Use Export PDF for thermal-friendly summaries or share with your accountant.</p>
        </div>
      </Card>
    </div>
  );
}
