import { NextResponse } from "next/server";
import { autorizarApi } from "@/lib/api-auth";
import { obterPrisma } from "@/lib/prisma";
import { isRecord } from "@/lib/task-api";

const categorySelect = {
  id: true,
  sigla: true,
  nome: true,
  cor: true,
  ativa: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(request: Request) {
  const includeInactive = new URL(request.url).searchParams.get("incluirInativas") === "true";
  const authorization = await autorizarApi(request, "categorias", includeInactive ? "editar" : "visualizar");
  if ("response" in authorization) return authorization.response;

  try {
    const categorias = await obterPrisma().category.findMany({
      where: includeInactive ? undefined : { ativa: true },
      select: categorySelect,
      orderBy: [{ ativa: "desc" }, { nome: "asc" }],
    });
    return NextResponse.json({ categorias }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao listar categorias:", error);
    return NextResponse.json({ error: "Não foi possível carregar as categorias." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await autorizarApi(request, "categorias", "criar");
  if ("response" in authorization) return authorization.response;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    const parsed = parseCategory(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const categoria = await obterPrisma().category.create({
      data: { ...parsed.data, ativa: true },
      select: categorySelect,
    });
    return NextResponse.json({ categoria }, { status: 201 });
  } catch (error) {
    console.error("Falha ao criar categoria:", error);
    if (error instanceof SyntaxError) return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    if (getDatabaseErrorCode(error) === "P2002") return NextResponse.json({ error: "Já existe uma categoria com essa sigla." }, { status: 409 });
    return NextResponse.json({ error: "Não foi possível cadastrar a categoria." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authorization = await autorizarApi(request, "categorias", "editar");
  if ("response" in authorization) return authorization.response;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.id !== "string" || !body.id) {
      return NextResponse.json({ error: "Informe a categoria a atualizar." }, { status: 400 });
    }

    const data: { nome?: string; sigla?: string; cor?: string; ativa?: boolean } = {};
    if (Object.hasOwn(body, "nome") || Object.hasOwn(body, "sigla") || Object.hasOwn(body, "cor")) {
      const parsed = parseCategory(body);
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      Object.assign(data, parsed.data);
    }
    if (Object.hasOwn(body, "ativa")) {
      if (typeof body.ativa !== "boolean") return NextResponse.json({ error: "O status da categoria é inválido." }, { status: 400 });
      data.ativa = body.ativa;
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Informe ao menos um campo para atualizar." }, { status: 400 });

    const categoria = await obterPrisma().category.update({
      where: { id: body.id },
      data,
      select: categorySelect,
    });
    return NextResponse.json({ categoria });
  } catch (error) {
    console.error("Falha ao atualizar categoria:", error);
    if (error instanceof SyntaxError) return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    if (getDatabaseErrorCode(error) === "P2002") return NextResponse.json({ error: "Já existe uma categoria com essa sigla." }, { status: 409 });
    if (getDatabaseErrorCode(error) === "P2025") return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
    return NextResponse.json({ error: "Não foi possível atualizar a categoria." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authorization = await autorizarApi(request, "categorias", "excluir");
  if ("response" in authorization) return authorization.response;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.id !== "string" || !body.id) {
      return NextResponse.json({ error: "Informe a categoria a desativar." }, { status: 400 });
    }
    const categoria = await obterPrisma().category.update({
      where: { id: body.id },
      data: { ativa: false },
      select: categorySelect,
    });
    return NextResponse.json({ categoria });
  } catch (error) {
    console.error("Falha ao desativar categoria:", error);
    if (error instanceof SyntaxError) return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    if (getDatabaseErrorCode(error) === "P2025") return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
    return NextResponse.json({ error: "Não foi possível desativar a categoria." }, { status: 500 });
  }
}

function parseCategory(body: Record<string, unknown>): { data: { nome: string; sigla: string; cor: string } } | { error: string } {
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const sigla = typeof body.sigla === "string" ? body.sigla.trim().toLocaleUpperCase("pt-BR") : "";
  const cor = typeof body.cor === "string" ? body.cor.trim() : "";
  if (!nome || nome.length > 120) return { error: "Informe um nome válido com até 120 caracteres." };
  if (!/^[A-Z0-9-]{1,20}$/.test(sigla)) return { error: "Informe uma sigla válida com até 20 caracteres." };
  if (!/^#[0-9A-Fa-f]{6}$/.test(cor)) return { error: "Informe uma cor hexadecimal válida." };
  return { data: { nome, sigla, cor: cor.toUpperCase() } };
}

function getDatabaseErrorCode(error: unknown): unknown {
  return isRecord(error) && "code" in error ? error.code : undefined;
}
