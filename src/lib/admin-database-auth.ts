import { NextResponse } from "next/server";
import { obterSessaoDaRequisicao } from "@/lib/auth";

export async function authorizeDatabaseAdministration(request: Request) {
  try {
    const user = await obterSessaoDaRequisicao(request);
    if (!user) {
      return {
        response: NextResponse.json({ error: "Autenticação necessária." }, { status: 401 }),
      } as const;
    }
    if (!user.permissoes.administradorTotal) {
      return {
        response: NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 }),
      } as const;
    }
    return { user } as const;
  } catch (error) {
    console.error("Falha ao verificar acesso administrativo ao banco de dados:", error);
    return {
      response: NextResponse.json({ error: "Não foi possível validar as permissões da sessão." }, { status: 500 }),
    } as const;
  }
}
