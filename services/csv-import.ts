import Papa from "papaparse";

export function parseCsv<T>(file: File) {
  return new Promise<T[]>((resolve, reject) => {
    Papa.parse<T>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => resolve(result.data),
      error: reject,
    });
  });
}
