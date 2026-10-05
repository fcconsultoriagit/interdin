import { NextResponse } from "next/server";
import { obterSessaoDaRequisicao } from "@/lib/auth";
import { can, type PermissionAction } from "@/lib/rbac";

export async function autorizarApi(
  request: Request,
  resource: string,
  action: PermissionAction,
): Promise<{ user: NonNullable<Awaited<ReturnType<typeof obterSessaoDaRequisicao>>> } | { response: NextResponse }> {
  try {
    const user = await obterSessaoDaRequisicao(request);
    if (!user) {
      return {
        response: NextResponse.json(
          { error: "Autenticação necessária." },
          { status: 401, headers: { "Cache-Control": "no-store" } },
        ),
      };
    }
    if (!can(user.permissoes, resource, action)) {
      return {
        response: NextResponse.json(
          { error: "Seu perfil não possui permissão para esta ação.", recurso: resource, acao: action },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        ),
      };
    }
    return { user };
  } catch (error) {
    console.error(`Falha ao autorizar API ${resource}.${action}:`, error);
    return {
      response: NextResponse.json(
        { error: "Não foi possível validar as permissões da sessão." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
}
