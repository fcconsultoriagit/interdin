import { NextResponse } from "next/server";
import { obterPrisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cargos = await obterPrisma().cargo.findMany({
      orderBy: { nome: "asc" },
      include: { _count: { select: { usuarios: true } } },
    });
    return NextResponse.json({ cargos });
  } catch (error) {
    console.error("Falha ao listar cargos:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar os cargos." },
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
    if (!nome || nome.length > 120) {
      return NextResponse.json({ error: "Informe um nome válido para o cargo." }, { status: 400 });
    }

    const cargo = await obterPrisma().cargo.create({
      data: { nome },
      include: { _count: { select: { usuarios: true } } },
    });
    return NextResponse.json({ cargo }, { status: 201 });
  } catch (error) {
    console.error("Falha ao cadastrar cargo:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    if (getDatabaseErrorCode(error) === "P2002") {
      return NextResponse.json({ error: "Já existe um cargo com esse nome." }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Não foi possível cadastrar o cargo." },
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
