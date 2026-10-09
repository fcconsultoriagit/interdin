import { NextResponse } from "next/server";
import { autorizarApi } from "@/lib/api-auth";
import { decisionStatuses, sumulaVisibilityWhere } from "@/lib/meeting-sumulas";
import { obterPrisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authorization = await autorizarApi(request, "decisoes", "visualizar");
  if ("response" in authorization) return authorization.response;
  try {
    const status = new URL(request.url).searchParams.get("status");
    if (status && status !== "TODAS" && !decisionStatuses.includes(status as (typeof decisionStatuses)[number])) {
      return NextResponse.json({ error: "Filtro de status inválido." }, { status: 400 });
    }
    const decisoes = await obterPrisma().meetingDecision.findMany({
      where: {
        sumula: { is: sumulaVisibilityWhere(authorization.user.id) },
        ...(status && status !== "TODAS" ? { status } : {}),
      },
      select: {
        id: true,
        assunto: true,
        deliberacao: true,
        responsavelNome: true,
        responsavelEmail: true,
        prazo: true,
        status: true,
        sumula: {
          select: {
            id: true,
            codigo: true,
            titulo: true,
            privada: true,
            autorId: true,
            autor: { select: { nome: true } },
          },
        },
      },
      orderBy: [{ prazo: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ decisoes }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Falha ao listar decisões de reuniões:", error);
    return NextResponse.json({ error: "Não foi possível carregar as decisões." }, { status: 500 });
  }
}
