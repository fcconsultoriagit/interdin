import { NextResponse } from "next/server";
import { authorizeMeetingRecord } from "@/lib/meeting-agendas";
import { sendMeetingInvitation } from "@/lib/meeting-mail";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

function isValidEmail(value: string) {
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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
      console.info("Resumo do envio de convites da reunião:", {
        agendaId: id,
        participantes: 0,
        enviados: 0,
        falhas: 0,
      });
      return NextResponse.json({ error: "Adicione pelo menos um participante antes de enviar os convites." }, { status: 400 });
    }

    let enviados = 0;
    const falhas: Array<{ participanteId: string; email: string; error: string }> = [];
    const participantesValidos = agenda.participantes.filter((participant) => isValidEmail(participant.email));

    for (const participant of agenda.participantes) {
      if (!isValidEmail(participant.email)) {
        falhas.push({
          participanteId: participant.id,
          email: participant.email,
          error: "O endereço de e-mail do participante é inválido.",
        });
      }
    }

    for (const participant of participantesValidos) {
      try {
        await sendMeetingInvitation(agenda, {
          ...participant,
          email: participant.email.trim(),
        });
        enviados += 1;
      } catch (error) {
        console.error("Falha ao enviar convite individual de reunião:", {
          agendaId: id,
          participanteId: participant.id,
          error,
        });
        falhas.push({
          participanteId: participant.id,
          email: participant.email,
          error: error instanceof Error ? error.message : "Falha ao enviar o e-mail.",
        });
      }
    }

    const resumo = {
      agendaId: id,
      participantes: agenda.participantes.length,
      tentativas: participantesValidos.length,
      enviados,
      falhas: falhas.length,
    };
    console.info("Resumo do envio de convites da reunião:", resumo);

    return NextResponse.json(
      {
        enviados,
        falhas,
        falhasCount: falhas.length,
        total: agenda.participantes.length,
        tentativas: participantesValidos.length,
      },
      { status: falhas.length ? 502 : 200 },
    );
  } catch (error) {
    console.error("Falha ao notificar participantes da reunião:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível enviar os convites.",
    }, { status: 500 });
  }
}
