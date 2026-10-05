import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { AppFrame } from "@/components/app-frame";

export function AccessDenied() {
  return (
    <AppFrame section="Acesso negado">
      <div className="page-wrap">
        <section className="empty-state access-denied" aria-labelledby="access-denied-title">
          <span className="empty-state-icon"><ShieldAlert size={25} /></span>
          <div className="eyebrow">CONTROLE DE ACESSO</div>
          <h1 id="access-denied-title">403 — Acesso Negado</h1>
          <p>Seu perfil não possui permissão para visualizar este recurso. Se precisar de acesso, solicite a atualização do seu perfil ao administrador do sistema.</p>
          <Link className="button button-primary" href="/painel">Voltar ao painel inicial</Link>
        </section>
      </div>
    </AppFrame>
  );
}
