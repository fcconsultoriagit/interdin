import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { obterPrisma } from "@/lib/prisma";
import { isRecord, readRelationIds, validateRelations } from "@/lib/usuarios";

const usuarioSelect = {
  id: true,
  nome: true,
  email: true,
  ativo: true,
  unidadeId: true,
  cargoId: true,
  perfilId: true,
  createdAt: true,
  updatedAt: true,
  unidade: { select: { id: true, nome: true, sigla: true, ativo: true } },
  cargo: { select: { id: true, nome: true, ativo: true } },
  perfil: {
    select: {
      id: true,
      nome: true,
      ativo: true,
      permissoes: {
        select: {
          verMenu: true,
          visualizar: true,
          criar: true,
          editar: true,
          excluir: true,
        },
      },
    },
  },
} as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  return updateUser(request, params);
}

export async function PUT(request: Request, { params }: RouteContext) {
  return updateUser(request, params);
}

async function updateUser(request: Request, paramsPromise: RouteContext["params"]) {
  const { id } = await paramsPromise;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || Object.keys(body).length === 0) {
      return NextResponse.json({ error: "Informe os dados que deseja atualizar." }, { status: 400 });
    }

    const data: {
      nome?: string;
      email?: string;
      senhaHash?: string;
      ativo?: boolean;
      unidadeId?: string | null;
      cargoId?: string | null;
      perfilId?: string | null;
    } = {};

    if ("nome" in body) {
      const nome = typeof body.nome === "string" ? body.nome.trim() : "";
      if (!nome || nome.length > 160) {
        return NextResponse.json({ error: "O nome informado é inválido." }, { status: 400 });
      }
      data.nome = nome;
    }
    if ("email" in body) {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "O e-mail informado é inválido." }, { status: 400 });
      }
      data.email = email;
    }
    if ("senha" in body) {
      if (typeof body.senha !== "string") {
        return NextResponse.json({ error: "A senha informada é inválida." }, { status: 400 });
      }
      if (body.senha.length > 0) {
        if (body.senha.length < 8) {
          return NextResponse.json(
            { error: "A senha deve ter pelo menos 8 caracteres." },
            { status: 400 },
          );
        }
        if (!isValidPasswordLength(body.senha)) {
          return NextResponse.json({ error: "A senha não pode exceder 72 bytes." }, { status: 400 });
        }
        data.senhaHash = await hash(body.senha, 12);
      }
    }
    if ("ativo" in body) {
      if (typeof body.ativo !== "boolean") {
        return NextResponse.json({ error: "O status informado é inválido." }, { status: 400 });
      }
      data.ativo = body.ativo;
    }

    const relations = readRelationIds(body);
    if (!relations) {
      return NextResponse.json({ error: "Uma ou mais relações informadas são inválidas." }, { status: 400 });
    }
    const prisma = obterPrisma();
    const currentUser = await prisma.user.findUnique({
      where: { id },
      select: { unidadeId: true, cargoId: true, perfilId: true },
    });
    if (!currentUser) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }
    if (data.email) {
      const duplicate = await prisma.user.findFirst({
        where: { email: { equals: data.email, mode: "insensitive" }, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json({ error: "Já existe um usuário cadastrado com esse e-mail." }, { status: 409 });
      }
    }
    const relationError = await validateRelations(prisma, relations, currentUser);
    if (relationError) {
      return NextResponse.json({ error: relationError }, { status: 400 });
    }
    Object.assign(data, relations);

    if (Object.keys(data).length === 0) {
      if ("senha" in body && body.senha === "") {
        const usuario = await prisma.user.findUnique({
          where: { id },
          select: usuarioSelect,
        });
        if (!usuario) {
          return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
        }
        return NextResponse.json({ usuario });
      }
      return NextResponse.json({ error: "Não há dados válidos para atualizar." }, { status: 400 });
    }

    const usuario = await prisma.user.update({
      where: { id },
      data,
      select: usuarioSelect,
    });
    return NextResponse.json({ usuario });
  } catch (error) {
    console.error("Falha ao atualizar usuário:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    const code = getDatabaseErrorCode(error);
    if (code === "P2002") {
      return NextResponse.json({ error: "Já existe um usuário cadastrado com esse e-mail." }, { status: 409 });
    }
    return NextResponse.json(
      { error: code === "P2025" ? "Usuário não encontrado." : "Não foi possível atualizar o usuário." },
      { status: code === "P2025" ? 404 : 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const usuario = await obterPrisma().user.update({
      where: { id },
      data: { ativo: false },
      select: { id: true, ativo: true },
    });
    return NextResponse.json({ usuario });
  } catch (error) {
    console.error("Falha ao desativar usuário:", error);
    const code = getDatabaseErrorCode(error);
    return NextResponse.json(
      { error: code === "P2025" ? "Usuário não encontrado." : "Não foi possível desativar o usuário." },
      { status: code === "P2025" ? 404 : 500 },
    );
  }
}

function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPasswordLength(password: string): boolean {
  return new TextEncoder().encode(password).length <= 72;
}

function getDatabaseErrorCode(error: unknown): unknown {
  return isRecord(error) && "code" in error ? error.code : undefined;
}
