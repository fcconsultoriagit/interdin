import { NextResponse } from "next/server";
import { obterPrisma } from "@/lib/prisma";

export async function GET() {
  try {
    const unidades = await obterPrisma().unidade.findMany({
      orderBy: { nome: "asc" },
      include: { _count: { select: { usuarios: true } } },
    });
    return NextResponse.json({ unidades });
  } catch (error) {
    console.error("Falha ao listar unidades:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar as unidades." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    }

    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const sigla = typeof body.sigla === "string" ? body.sigla.trim().toUpperCase() : "";
    if (!nome || nome.length > 120 || !sigla || sigla.length > 20) {
      return NextResponse.json(
        { error: "Informe um nome e uma sigla válidos para a unidade." },
        { status: 400 },
      );
    }

    const unidade = await obterPrisma().unidade.create({
      data: { nome, sigla },
      include: { _count: { select: { usuarios: true } } },
    });
    return NextResponse.json({ unidade }, { status: 201 });
  } catch (error) {
    console.error("Falha ao cadastrar unidade:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    if (getDatabaseErrorCode(error) === "P2002") {
      return NextResponse.json({ error: "Já existe uma unidade com essa sigla." }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Não foi possível cadastrar a unidade." },
      { status: 500 },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDatabaseErrorCode(error: unknown): unknown {
  return isRecord(error) && "code" in error ? error.code : undefined;
}
