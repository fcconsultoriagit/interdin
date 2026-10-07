import { NextResponse } from "next/server";
import { authorizeMeetingAction } from "@/lib/meeting-agendas";
import { obterPrisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authorization = await authorizeMeetingAction(request, "visualizar");
  if ("response" in authorization) return authorization.response;
  try {
    const usuarios = await obterPrisma().user.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, email: true },
      orderBy: [{ nome: "asc" }, { email: "asc" }],
    });
    return NextResponse.json({ usuarios }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Falha ao carregar usuários para participantes de reuniões:", error);
    return NextResponse.json({ error: "Não foi possível carregar os usuários." }, { status: 500 });
  }
}
