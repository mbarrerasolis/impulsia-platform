const LOCAL_URL = "http://localhost:3000";

export function getPublicSiteUrl(value = process.env.NEXT_PUBLIC_APP_URL): URL {
  const url = new URL(value || LOCAL_URL);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

export function isTemporarySiteUrl(value = process.env.NEXT_PUBLIC_APP_URL): boolean {
  const { hostname } = getPublicSiteUrl(value);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".vercel.app");
}

export function getPasswordResetRedirectUrl(value = process.env.NEXT_PUBLIC_APP_URL): URL {
  return new URL("/auth/set-password", getPublicSiteUrl(value));
}
