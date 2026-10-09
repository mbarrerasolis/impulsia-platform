import { ImageResponse } from "next/og";
import { getBrandConfig } from "@/lib/brand";
import { getEmblemDataUri } from "@/lib/emblem";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const brand = getBrandConfig();
  const emblem = getEmblemDataUri();
  // Ediciones con isotipo (vitrinas): fondo del color de acento y textos en negro, como la marca.
  const ink = emblem ? "#000000" : "white";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: emblem ? brand.accentColor : `linear-gradient(135deg,${brand.primaryDarkColor} 0%,${brand.primaryColor} 55%,${brand.darkSurfaceColor} 100%)`,
          color: ink,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {emblem
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse sólo admite <img>
            ? <img src={emblem} width={96} height={96} alt="" />
            : <div style={{ display: "flex", width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,.14)", alignItems: "center", justifyContent: "center" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill={brand.accentColor}>
              <path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />
            </svg>
          </div>}
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>{brand.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 800, lineHeight: 1.08, letterSpacing: -2, maxWidth: 980 }}>
            {brand.heroTitle} {brand.heroHighlight}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: emblem ? "#4A3A2C" : "#d8ede9", maxWidth: 820 }}>
            {brand.description}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
