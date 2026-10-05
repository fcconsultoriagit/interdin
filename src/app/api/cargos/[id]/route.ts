import { NextResponse } from "next/server";
import { obterPrisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || Object.keys(body).length === 0) {
      return NextResponse.json({ error: "Informe os dados do cargo." }, { status: 400 });
    }

    const data: { nome?: string; ativo?: boolean } = {};
    if ("nome" in body) {
      const nome = typeof body.nome === "string" ? body.nome.trim() : "";
      if (!nome || nome.length > 120) {
        return NextResponse.json({ error: "O nome do cargo é inválido." }, { status: 400 });
      }
      data.nome = nome;
    }
    if ("ativo" in body) {
      if (typeof body.ativo !== "boolean") {
        return NextResponse.json({ error: "O status informado é inválido." }, { status: 400 });
      }
      data.ativo = body.ativo;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Não há campos válidos para atualizar." }, { status: 400 });
    }

    const cargo = await obterPrisma().cargo.update({
      where: { id },
      data,
      include: { _count: { select: { usuarios: true } } },
    });
    return NextResponse.json({ cargo });
  } catch (error) {
    console.error("Falha ao atualizar cargo:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    const code = getDatabaseErrorCode(error);
    if (code === "P2002") {
      return NextResponse.json({ error: "Já existe um cargo com esse nome." }, { status: 409 });
    }
    return NextResponse.json(
      { error: code === "P2025" ? "Cargo não encontrado." : "Não foi possível atualizar o cargo." },
      { status: code === "P2025" ? 404 : 500 },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDatabaseErrorCode(error: unknown): unknown {
  return isRecord(error) && "code" in error ? error.code : undefined;
}
