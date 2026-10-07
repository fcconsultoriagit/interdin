import { NextResponse } from "next/server";
import { obterPrisma } from "@/lib/prisma";
import { isRecord, participantConfirmations } from "@/lib/meeting-agendas";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ error: "Token de confirmação ausente." }, { status: 400 });
  try {
    const participant = await obterPrisma().meetingParticipant.findUnique({
      where: { tokenConfirmacao: token },
      select: {
        nome: true,
        confirmacao: true,
        agenda: { select: { titulo: true, dataHora: true, localOuLink: true, status: true } },
      },
    });
    if (!participant) return NextResponse.json({ error: "Este convite não foi encontrado ou já não é válido." }, { status: 404 });
    return NextResponse.json({ participante: participant }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao consultar convite de reunião:", error);
    return NextResponse.json({ error: "Não foi possível carregar os dados do convite." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const confirmacao = isRecord(body)
      ? participantConfirmations.find((value) => value === body.confirmacao)
      : undefined;
    if (!isRecord(body) || typeof body.token !== "string" || !confirmacao || confirmacao === "PENDENTE") {
      return NextResponse.json({ error: "Informe um token e uma resposta de confirmação válidos." }, { status: 400 });
    }
    const prisma = obterPrisma();
    const participant = await prisma.meetingParticipant.findUnique({
      where: { tokenConfirmacao: body.token },
      select: { id: true, agenda: { select: { status: true } } },
    });
    if (!participant) return NextResponse.json({ error: "Este convite não foi encontrado ou já não é válido." }, { status: 404 });
    if (participant.agenda.status === "CANCELADA") {
      return NextResponse.json({ error: "Esta reunião foi cancelada e não aceita confirmações." }, { status: 409 });
    }
    const updated = await prisma.meetingParticipant.update({
      where: { id: participant.id },
      data: { confirmacao },
      select: { nome: true, confirmacao: true },
    });
    return NextResponse.json({ participante: updated });
  } catch (error) {
    console.error("Falha ao salvar confirmação de reunião:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    return NextResponse.json({ error: "Não foi possível registrar a confirmação." }, { status: 500 });
  }
}
