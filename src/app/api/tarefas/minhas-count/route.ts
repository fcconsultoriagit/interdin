import { NextResponse } from "next/server";
import { autorizarApi } from "@/lib/api-auth";
import { obterPrisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authorization = await autorizarApi(request, "minhas-tarefas", "visualizar");
  if ("response" in authorization) return authorization.response;

  try {
    const total = await obterPrisma().task.count({
      where: { responsavelId: authorization.user.id },
    });
    return NextResponse.json({ total }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao contar tarefas atribuídas:", error);
    return NextResponse.json({ error: "Não foi possível carregar a contagem de tarefas." }, { status: 500 });
  }
}
