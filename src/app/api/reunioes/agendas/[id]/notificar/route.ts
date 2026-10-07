import { NextResponse } from "next/server";
import { authorizeMeetingRecord } from "@/lib/meeting-agendas";
import { sendMeetingInvitation } from "@/lib/meeting-mail";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await authorizeMeetingRecord(request, id, "edit");
  if ("response" in access) return access.response;

  try {
    const agenda = await access.prisma.meetingAgenda.findUnique({
      where: { id },
      select: {
        id: true,
        titulo: true,
        dataHora: true,
        localOuLink: true,
        pauta: true,
        status: true,
        participantes: {
          select: { id: true, nome: true, email: true, tokenConfirmacao: true },
          orderBy: { nome: "asc" },
        },
      },
    });
    if (!agenda) return NextResponse.json({ error: "Agenda não encontrada." }, { status: 404 });
    if (agenda.status !== "AGENDADA") {
      return NextResponse.json({ error: "Salve a agenda com status AGENDADA antes de enviar convites." }, { status: 409 });
    }
    if (agenda.participantes.length === 0) {
      return NextResponse.json({ error: "Adicione pelo menos um participante antes de enviar os convites." }, { status: 400 });
    }
    let enviados = 0;
    const falhas: Array<{ email: string; error: string }> = [];
    for (const participant of agenda.participantes) {
      try {
        await sendMeetingInvitation(agenda, participant);
        enviados += 1;
      } catch (error) {
        console.error(`Falha ao enviar convite de reunião para ${participant.email}:`, error);
        falhas.push({
          email: participant.email,
          error: error instanceof Error ? error.message : "Falha ao enviar o e-mail.",
        });
      }
    }
    return NextResponse.json(
      { enviados, falhas, total: agenda.participantes.length },
      { status: falhas.length ? 502 : 200 },
    );
  } catch (error) {
    console.error("Falha ao notificar participantes da reunião:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível enviar os convites.",
    }, { status: 500 });
  }
}
