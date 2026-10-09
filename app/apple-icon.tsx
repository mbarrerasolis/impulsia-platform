import { ImageResponse } from "next/og";
import { getBrandConfig } from "@/lib/brand";
import { getEmblemDataUri } from "@/lib/emblem";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const brand = getBrandConfig();
  const emblem = getEmblemDataUri();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: emblem ? brand.accentColor : brand.primaryDarkColor }}>
        {emblem
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse sólo admite <img>
          ? <img src={emblem} width={128} height={128} alt="" />
          : <svg width="104" height="104" viewBox="0 0 24 24" fill={brand.accentColor}>
            <path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />
          </svg>}
      </div>
    ),
    size,
  );
}
