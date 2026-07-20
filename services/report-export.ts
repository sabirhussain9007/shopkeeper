import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportRowsToPdf(title: string, headers: string[], rows: Array<Array<string | number>>) {
  const doc = new jsPDF();
  doc.text(title, 14, 16);
  autoTable(doc, { startY: 24, head: [headers], body: rows });
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

/** CSV export that opens cleanly in Excel. */
export function exportRowsToExcel(title: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.toLowerCase().replace(/\s+/g, "-")}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
