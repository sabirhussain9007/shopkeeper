import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.name} — POS, inventory, and ledger for Pakistani retailers`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "linear-gradient(135deg, #0c1f1a 0%, #10362c 100%)",
        padding: "80px",
        color: "#f3f7f4",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "72px",
            height: "72px",
            borderRadius: "24px",
            background: "#34d399",
            color: "#0c1f1a",
            fontSize: "40px",
            fontWeight: 700,
          }}
        >
          S
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "40px",
            fontWeight: 600,
            color: "#ffffff",
          }}
        >
          {siteConfig.name}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div
          style={{
            display: "flex",
            fontSize: "76px",
            lineHeight: 1.1,
            color: "#ffffff",
            fontWeight: 700,
          }}
        >
          Run your shop. Own your till.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "34px",
            color: "rgba(209, 250, 229, 0.75)",
          }}
        >
          POS · Inventory · Khata · Reports
        </div>
      </div>

      <div style={{ display: "flex", fontSize: "28px", color: "#6ee7b7" }}>
        Multi-shop retail SaaS for Pakistani retailers
      </div>
    </div>,
    size,
  );
}
