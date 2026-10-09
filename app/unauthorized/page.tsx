import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Acceso no autorizado", robots: { index: false, follow: false } };
export default function UnauthorizedPage(){return <main className="container" style={{paddingBlock:100,textAlign:"center"}}><h1>Acceso no autorizado</h1><p className="muted">Tu perfil no tiene permisos para abrir esta sección.</p><Link className="btn btn-primary" href="/">Volver al inicio</Link></main>}
