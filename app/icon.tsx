import { ImageResponse } from "next/og";
import { getBrandConfig } from "@/lib/brand";
import { getEmblemDataUri } from "@/lib/emblem";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  const brand = getBrandConfig();
  const emblem = getEmblemDataUri();
  if (emblem) {
    // eslint-disable-next-line @next/next/no-img-element -- ImageResponse sólo admite <img>
    return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex" }}><img src={emblem} width={32} height={32} alt="" /></div>, size);
  }
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: brand.primaryDarkColor, borderRadius: 7 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill={brand.accentColor}>
          <path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />
        </svg>
      </div>
    ),
    size,
  );
}
