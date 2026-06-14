import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportRowsToPdf(title: string, headers: string[], rows: Array<Array<string | number>>) {
  const doc = new jsPDF();
  doc.text(title, 14, 16);
  autoTable(doc, { startY: 24, head: [headers], body: rows });
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
