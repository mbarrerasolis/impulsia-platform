export function getSupabaseAuthStorageKey(supabaseUrl: string) {
  const hostname = new URL(supabaseUrl).hostname;
  return `sb-${hostname.split(".")[0]}-auth-token`;
}

export function isSupabaseSessionCookie(name: string, supabaseUrl: string) {
  const storageKey = getSupabaseAuthStorageKey(supabaseUrl);
  return name === storageKey || name.startsWith(`${storageKey}.`) || name.startsWith(`${storageKey}-`);
}

export function getSupabaseSessionCookieNames(cookieNames: readonly string[], supabaseUrl: string) {
  return cookieNames.filter((name) => isSupabaseSessionCookie(name, supabaseUrl));
}
