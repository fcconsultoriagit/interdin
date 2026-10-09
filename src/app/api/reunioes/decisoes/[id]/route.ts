import { NextResponse } from "next/server";
import { autorizarApi } from "@/lib/api-auth";
import { decisionStatuses, isSumulaRecord } from "@/lib/meeting-sumulas";
import { obterPrisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await autorizarApi(request, "decisoes", "editar");
  if ("response" in authorization) return authorization.response;
  const { id } = await params;
  try {
    const body: unknown = await request.json();
    if (!isSumulaRecord(body) || !decisionStatuses.includes(body.status as (typeof decisionStatuses)[number])) {
      return NextResponse.json({ error: "Informe um status válido para a decisão." }, { status: 400 });
    }
    const decision = await obterPrisma().meetingDecision.findFirst({
      where: { id, sumula: { autorId: authorization.user.id } },
      select: { id: true },
    });
    if (!decision) return NextResponse.json({ error: "Decisão não encontrada." }, { status: 404 });
    const updated = await obterPrisma().meetingDecision.update({
      where: { id },
      data: { status: body.status as (typeof decisionStatuses)[number] },
      select: { id: true, status: true },
    });
    return NextResponse.json({ decisao: updated });
  } catch (error) {
    console.error("Falha ao atualizar status da decisão:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    return NextResponse.json({ error: "Não foi possível atualizar a decisão." }, { status: 500 });
  }
}
