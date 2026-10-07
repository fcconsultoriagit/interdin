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
    let pendingOnly = false;
    let requestedParticipantIds: string[] = [];
    if (request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      const body: unknown = await request.json();
      if (typeof body !== "object" || body === null || Array.isArray(body) ||
        ("pendingOnly" in body && typeof body.pendingOnly !== "boolean") ||
        ("participantIds" in body && (!Array.isArray(body.participantIds) ||
          !body.participantIds.every((participantId) => typeof participantId === "string")))) {
        return NextResponse.json({ error: "Os filtros de envio são inválidos." }, { status: 400 });
      }
      pendingOnly = "pendingOnly" in body && body.pendingOnly === true;
      requestedParticipantIds = "participantIds" in body ? body.participantIds as string[] : [];
    }

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
          select: { id: true, nome: true, email: true, tokenConfirmacao: true, confirmacao: true },
          orderBy: { nome: "asc" },
        },
      },
    });
    if (!agenda) return NextResponse.json({ error: "Agenda não encontrada." }, { status: 404 });
    if (agenda.status !== "AGENDADA") {
      return NextResponse.json({ error: "Salve a agenda com status AGENDADA antes de enviar convites." }, { status: 409 });
    }
    const participantesSelecionados = agenda.participantes.filter((participant) =>
      pendingOnly
        ? participant.confirmacao === "PENDENTE"
        : requestedParticipantIds.length > 0
          ? participant.confirmacao === "PENDENTE" || requestedParticipantIds.includes(participant.id)
          : true,
    );
    if (participantesSelecionados.length === 0) {
      console.info("Resumo do envio de convites da reunião:", {
        agendaId: id,
        participantes: agenda.participantes.length,
        pendentes: 0,
        enviados: 0,
        falhas: 0,
      });
      return NextResponse.json({ ok: true, enviados: 0, falhas: [] });
    }

    let enviados = 0;
    let modoDesenvolvimento = 0;
    const falhas: Array<{ participanteId: string; email: string; error: string }> = [];
    const participantesValidos = participantesSelecionados.filter((participant) => isValidEmail(participant.email));

    for (const participant of participantesSelecionados) {
      if (!isValidEmail(participant.email)) {
        falhas.push({
          participanteId: participant.id,
          email: participant.email,
          error: "O endereço de e-mail do participante é inválido.",
        });
      }
    }

    let sentIndex = 0;
    for (const participant of participantesValidos) {
      try {
        const result = await sendMeetingInvitation(agenda, {
          ...participant,
          email: participant.email.trim(),
        });
        enviados += 1;
        if (result.developmentFallback) modoDesenvolvimento += 1;
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
      sentIndex += 1;
      if (sentIndex < participantesValidos.length) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }

    const resumo = {
      agendaId: id,
      participantes: participantesSelecionados.length,
      pendentes: participantesSelecionados.filter(({ confirmacao }) => confirmacao === "PENDENTE").length,
      tentativas: participantesValidos.length,
      enviados,
      falhas: falhas.length,
      modoDesenvolvimento,
    };
    console.info("Resumo do envio de convites da reunião:", resumo);

    return NextResponse.json(
      {
        ok: true,
        enviados,
        falhas,
        modoDesenvolvimento,
        tentativas: participantesSelecionados.length,
      },
    );
  } catch (error) {
    console.error("Falha ao notificar participantes da reunião:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível enviar os convites.",
    }, { status: 500 });
  }
}
