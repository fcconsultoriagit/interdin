import { NextResponse } from "next/server";
import { authorizeSumulaAction } from "@/lib/meeting-sumulas";
import { meetingVisibilityWhere } from "@/lib/meeting-agendas";
import { obterPrisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authorization = await authorizeSumulaAction(request, "visualizar");
  if ("response" in authorization) return authorization.response;
  try {
    const agendas = await obterPrisma().meetingAgenda.findMany({
      where: meetingVisibilityWhere(authorization.user.id),
      select: {
        id: true,
        titulo: true,
        dataHora: true,
        privada: true,
        pauta: true,
        participantes: {
          select: { userId: true, nome: true, email: true, confirmacao: true },
          orderBy: { nome: "asc" },
        },
      },
      orderBy: [{ dataHora: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ agendas }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Falha ao carregar agendas para vincular a súmulas:", error);
    return NextResponse.json({ error: "Não foi possível carregar as agendas." }, { status: 500 });
  }
}
