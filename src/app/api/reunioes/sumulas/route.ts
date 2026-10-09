import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  authorizeSumulaAction,
  normalizeSumulaParticipants,
  parseSumulaInput,
  sumulaStatuses,
  sumulaVisibilityWhere,
  validateAgendaLink,
} from "@/lib/meeting-sumulas";
import { obterPrisma } from "@/lib/prisma";

const sumulaSelect = {
  id: true,
  codigo: true,
  titulo: true,
  dataReuniao: true,
  privada: true,
  status: true,
  agendaId: true,
  autorId: true,
  createdAt: true,
  updatedAt: true,
  autor: { select: { id: true, nome: true } },
  agenda: { select: { id: true, titulo: true, dataHora: true } },
  participantes: {
    select: {
      id: true,
      userId: true,
      nome: true,
      email: true,
      presencaConfirmada: true,
    },
    orderBy: { nome: "asc" },
  },
  decisoes: {
    select: {
      id: true,
      assunto: true,
      deliberacao: true,
      responsavelNome: true,
      responsavelEmail: true,
      prazo: true,
      status: true,
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

export async function GET(request: Request) {
  const authorization = await authorizeSumulaAction(request, "visualizar");
  if ("response" in authorization) return authorization.response;
  try {
    const searchParams = new URL(request.url).searchParams;
    const status = searchParams.get("status");
    const autorId = searchParams.get("autorId");
    const busca = searchParams.get("busca")?.trim();
    if (status && status !== "TODAS" && !sumulaStatuses.includes(status as (typeof sumulaStatuses)[number])) {
      return NextResponse.json({ error: "Filtro de status inválido." }, { status: 400 });
    }
    const filters: Prisma.MeetingSumulaWhereInput[] = [sumulaVisibilityWhere(authorization.user.id)];
    if (status && status !== "TODAS") filters.push({ status });
    if (autorId) filters.push({ autorId });
    if (busca) {
      filters.push({
        OR: [
          { titulo: { contains: busca, mode: "insensitive" } },
          { codigo: { contains: busca, mode: "insensitive" } },
        ],
      });
    }
    const sumulas = await obterPrisma().meetingSumula.findMany({
      where: { AND: filters },
      select: sumulaSelect,
      orderBy: [{ dataReuniao: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ sumulas }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Falha ao listar súmulas de reuniões:", error);
    return NextResponse.json({ error: "Não foi possível carregar as súmulas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeSumulaAction(request, "criar");
  if ("response" in authorization) return authorization.response;
  try {
    const body: unknown = await request.json();
    const parsed = parseSumulaInput(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const agendaError = await validateAgendaLink(parsed.agendaId, authorization.user);
    if (agendaError) return NextResponse.json({ error: agendaError }, { status: 400 });
    const participants = await normalizeSumulaParticipants(parsed.participantes);
    if (!participants) return NextResponse.json({ error: "Um ou mais participantes vinculados não existem." }, { status: 400 });

    const sumula = await obterPrisma().$transaction(async (transaction) => {
      const year = parsed.dataReuniao.getUTCFullYear();
      const sequence = await transaction.meetingSumulaSequence.upsert({
        where: { ano: year },
        create: { ano: year, ultimoNumero: 1 },
        update: { ultimoNumero: { increment: 1 } },
        select: { ultimoNumero: true },
      });
      const codigo = `SUM-${year}-${String(sequence.ultimoNumero).padStart(4, "0")}`;
      return transaction.meetingSumula.create({
        data: {
          codigo,
          titulo: parsed.titulo,
          dataReuniao: parsed.dataReuniao,
          privada: parsed.privada,
          status: parsed.status,
          agendaId: parsed.agendaId,
          autorId: authorization.user.id,
          participantes: { create: participants },
          decisoes: { create: parsed.decisoes },
        },
        select: sumulaSelect,
      });
    });
    return NextResponse.json({ sumula }, { status: 201 });
  } catch (error) {
    console.error("Falha ao criar súmula de reunião:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    return NextResponse.json({ error: "Não foi possível criar a súmula." }, { status: 500 });
  }
}
