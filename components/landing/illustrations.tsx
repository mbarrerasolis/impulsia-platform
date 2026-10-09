/**
 * Ilustraciones de la portada: trazo grueso en tinta, rellenos planos de la paleta de marca.
 * Se definen una vez como <symbol> y se usan con <Illustration name="…"/> o <use href="#lp-i-…"/>.
 */

const INK = "#0B2526";
const PAPER = "#F2F7F1";
const LIME = "#B8F74F";
const TEAL = "#0F766E";
const LILAC = "#D7CCFF";
const CORAL = "#FF8A65";

export type IllustrationName =
  | "ad" | "chat" | "crm" | "calendar" | "erp" | "chart"
  | "bot" | "shield" | "plug" | "gears" | "database" | "person";

export function IllustrationSprite() {
  return <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
    <defs>
      <marker id="lp-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill={INK} /></marker>

      <symbol id="lp-i-ad" viewBox="0 0 64 64">
        <rect x="16" y="3" width="32" height="58" rx="7" fill={INK} />
        <rect x="19" y="9" width="26" height="44" rx="3" fill={PAPER} />
        <rect x="22" y="12" width="20" height="16" rx="2" fill={LILAC} />
        <circle cx="32" cy="20" r="5" fill={TEAL} />
        <rect x="22" y="31" width="20" height="3" rx="1.5" fill={INK} />
        <rect x="22" y="36" width="13" height="3" rx="1.5" fill={TEAL} />
        <rect x="22" y="43" width="20" height="6" rx="3" fill={LIME} />
      </symbol>

      <symbol id="lp-i-chat" viewBox="0 0 64 64">
        <path d="M12 8h40a7 7 0 0 1 7 7v22a7 7 0 0 1-7 7H28L16 54V44h-4a7 7 0 0 1-7-7V15a7 7 0 0 1 7-7z" fill={TEAL} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <rect x="14" y="18" width="30" height="4" rx="2" fill={PAPER} />
        <rect x="14" y="27" width="20" height="4" rx="2" fill={LIME} />
        <circle cx="51" cy="51" r="9" fill={LIME} stroke={INK} strokeWidth="3" />
        <path d="M47 51l3 3 5-6" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </symbol>

      <symbol id="lp-i-crm" viewBox="0 0 64 64">
        <rect x="6" y="8" width="52" height="48" rx="8" fill={PAPER} stroke={INK} strokeWidth="3" />
        <circle cx="19" cy="22" r="5" fill={CORAL} stroke={INK} strokeWidth="2" />
        <rect x="28" y="19" width="22" height="3.5" rx="1.75" fill={INK} />
        <circle cx="19" cy="34" r="5" fill={LIME} stroke={INK} strokeWidth="2" />
        <rect x="28" y="31" width="16" height="3.5" rx="1.75" fill={INK} />
        <circle cx="19" cy="46" r="5" fill={LILAC} stroke={INK} strokeWidth="2" />
        <rect x="28" y="43" width="19" height="3.5" rx="1.75" fill={INK} />
      </symbol>

      <symbol id="lp-i-calendar" viewBox="0 0 64 64">
        <rect x="8" y="12" width="48" height="44" rx="6" fill={PAPER} stroke={INK} strokeWidth="3" />
        <path d="M8 18a6 6 0 0 1 6-6h36a6 6 0 0 1 6 6v6H8z" fill={TEAL} />
        <rect x="18" y="6" width="4" height="12" rx="2" fill={INK} />
        <rect x="42" y="6" width="4" height="12" rx="2" fill={INK} />
        <circle cx="21" cy="34" r="3" fill={LILAC} /><circle cx="32" cy="34" r="3" fill={LILAC} /><circle cx="43" cy="34" r="3" fill={LILAC} />
        <circle cx="21" cy="45" r="3" fill={LILAC} /><circle cx="32" cy="45" r="3" fill={LILAC} />
        <circle cx="43" cy="45" r="5.5" fill={LIME} stroke={INK} strokeWidth="2" />
      </symbol>

      <symbol id="lp-i-erp" viewBox="0 0 64 64">
        <path d="M32 6 58 18 32 30 6 18z" fill={LIME} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M6 18 32 30v28L6 46z" fill={TEAL} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M58 18 32 30v28l26-12z" fill={LILAC} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M19 12 45 24v8" fill="none" stroke={PAPER} strokeWidth="4" />
      </symbol>

      <symbol id="lp-i-chart" viewBox="0 0 64 64">
        <rect x="4" y="4" width="56" height="56" rx="12" fill={PAPER} stroke={INK} strokeWidth="3" />
        <rect x="13" y="38" width="8" height="13" rx="2" fill={LILAC} />
        <rect x="24" y="30" width="8" height="21" rx="2" fill={TEAL} />
        <rect x="35" y="24" width="8" height="27" rx="2" fill={TEAL} />
        <rect x="46" y="15" width="8" height="36" rx="2" fill={LIME} stroke={INK} strokeWidth="2" />
        <path d="M12 31 26 21 37 25 52 10" fill="none" stroke={CORAL} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </symbol>

      <symbol id="lp-i-bot" viewBox="0 0 64 64">
        <line x1="32" y1="4" x2="32" y2="14" stroke={INK} strokeWidth="3" />
        <circle cx="32" cy="5" r="4" fill={CORAL} stroke={INK} strokeWidth="2" />
        <rect x="10" y="14" width="44" height="36" rx="12" fill={LIME} stroke={INK} strokeWidth="3" />
        <rect x="16" y="22" width="32" height="16" rx="8" fill={INK} />
        <circle cx="25" cy="30" r="3.5" fill={LIME} /><circle cx="39" cy="30" r="3.5" fill={LIME} />
        <rect x="26" y="42" width="12" height="3" rx="1.5" fill={INK} />
        <path d="M18 50h28l4 10H14z" fill={TEAL} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      </symbol>

      <symbol id="lp-i-shield" viewBox="0 0 64 64">
        <path d="M32 4 54 12v18c0 15-9 24-22 30C19 54 10 45 10 30V12z" fill={TEAL} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M21 32l8 8 15-16" fill="none" stroke={LIME} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </symbol>

      <symbol id="lp-i-plug" viewBox="0 0 64 64">
        <rect x="4" y="22" width="22" height="20" rx="5" fill={LILAC} stroke={INK} strokeWidth="3" />
        <rect x="38" y="22" width="22" height="20" rx="5" fill={LIME} stroke={INK} strokeWidth="3" />
        <line x1="26" y1="27" x2="38" y2="27" stroke={INK} strokeWidth="3" />
        <line x1="26" y1="37" x2="38" y2="37" stroke={INK} strokeWidth="3" />
        <path d="M15 22V12M49 42v10" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <circle cx="15" cy="9" r="4" fill={CORAL} stroke={INK} strokeWidth="2" />
        <circle cx="49" cy="55" r="4" fill={TEAL} stroke={INK} strokeWidth="2" />
      </symbol>

      <symbol id="lp-i-gears" viewBox="0 0 64 64">
        <circle cx="24" cy="26" r="15" fill={LIME} stroke={INK} strokeWidth="3" strokeDasharray="6 3.4" />
        <circle cx="24" cy="26" r="9" fill={LIME} stroke={INK} strokeWidth="3" />
        <circle cx="24" cy="26" r="3.5" fill={INK} />
        <circle cx="44" cy="44" r="12" fill={TEAL} stroke={INK} strokeWidth="3" strokeDasharray="5 3" />
        <circle cx="44" cy="44" r="7" fill={TEAL} stroke={INK} strokeWidth="3" />
        <circle cx="44" cy="44" r="2.5" fill={PAPER} />
      </symbol>

      <symbol id="lp-i-database" viewBox="0 0 64 64">
        <ellipse cx="32" cy="14" rx="22" ry="8" fill={LIME} stroke={INK} strokeWidth="3" />
        <path d="M10 14v14c0 4.4 9.8 8 22 8s22-3.6 22-8V14" fill={LILAC} stroke={INK} strokeWidth="3" />
        <path d="M10 28v14c0 4.4 9.8 8 22 8s22-3.6 22-8V28" fill={TEAL} stroke={INK} strokeWidth="3" />
        <path d="M10 42v8c0 4.4 9.8 8 22 8s22-3.6 22-8v-8" fill={PAPER} stroke={INK} strokeWidth="3" />
      </symbol>

      <symbol id="lp-i-person" viewBox="0 0 64 64">
        <circle cx="32" cy="20" r="11" fill={CORAL} stroke={INK} strokeWidth="3" />
        <path d="M12 58c0-12 9-20 20-20s20 8 20 20z" fill={TEAL} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      </symbol>
    </defs>
  </svg>;
}

export function Illustration({ name, size = 64, className }: { name: IllustrationName; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href={`#lp-i-${name}`} /></svg>;
}
