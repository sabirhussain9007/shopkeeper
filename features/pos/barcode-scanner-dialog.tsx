"use client";

import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type BarcodeScannerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
};

export function BarcodeScannerDialog({ open, onOpenChange, onScan }: BarcodeScannerDialogProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionRef = useRef<HTMLDivElement | null>(null);
  const scannedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const regionId = "pos-barcode-scanner";

  useEffect(() => {
    function stopScanner(scanner: Html5Qrcode | null) {
      if (!scanner) return;
      try {
        scanner.stop();
      } catch {
        // scanner already stopped
      }
      try {
        scanner.clear();
      } catch {
        // scanner already cleared
      }
    }

    if (!open) {
      stopScanner(scannerRef.current);
      scannerRef.current = null;
      return;
    }

    scannedRef.current = false;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || !regionRef.current || !document.getElementById(regionId)) return;
      setError(null);

      let scanner: Html5Qrcode;
      try {
        scanner = new Html5Qrcode(regionId);
      } catch {
        setError("Camera scanner could not start. Type the barcode manually.");
        return;
      }

      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decoded) => {
            if (scannedRef.current) return;
            scannedRef.current = true;
            onScan(decoded);
            onOpenChange(false);
          },
          () => undefined,
        )
        .catch(() => {
          if (!cancelled) setError("Camera access denied or unavailable. Type the barcode manually.");
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopScanner(scannerRef.current);
      scannerRef.current = null;
    };
  }, [open, onOpenChange, onScan]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Scan Barcode" description="Point the camera at a product barcode.">
        <div ref={regionRef} id={regionId} className="min-h-64 overflow-hidden rounded-xl bg-black" />
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
