import { NextResponse } from "next/server";
import { autorizarApi } from "@/lib/api-auth";
import { obterPrisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await autorizarApi(request, "unidades", "editar");
  if ("response" in authorization) return authorization.response;
  const { id } = await params;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || Object.keys(body).length === 0) {
      return NextResponse.json({ error: "Informe os dados da unidade." }, { status: 400 });
    }

    const data: { nome?: string; sigla?: string; ativo?: boolean } = {};
    if ("nome" in body) {
      const nome = typeof body.nome === "string" ? body.nome.trim() : "";
      if (!nome || nome.length > 120) {
        return NextResponse.json({ error: "O nome da unidade é inválido." }, { status: 400 });
      }
      data.nome = nome;
    }
    if ("sigla" in body) {
      const sigla = typeof body.sigla === "string" ? body.sigla.trim().toUpperCase() : "";
      if (!sigla || sigla.length > 20) {
        return NextResponse.json({ error: "A sigla da unidade é inválida." }, { status: 400 });
      }
      data.sigla = sigla;
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

    const unidade = await obterPrisma().unidade.update({
      where: { id },
      data,
      include: { _count: { select: { usuarios: true } } },
    });
    return NextResponse.json({ unidade });
  } catch (error) {
    console.error("Falha ao atualizar unidade:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    const code = getDatabaseErrorCode(error);
    if (code === "P2002") {
      return NextResponse.json({ error: "Já existe uma unidade com essa sigla." }, { status: 409 });
    }
    return NextResponse.json(
      { error: code === "P2025" ? "Unidade não encontrada." : "Não foi possível atualizar a unidade." },
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
