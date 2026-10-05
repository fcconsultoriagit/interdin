import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { autorizarApi } from "@/lib/api-auth";
import { obterPrisma } from "@/lib/prisma";
import { canGrantPermissions, toGrantablePermissions } from "@/lib/rbac";
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

export async function GET(request: Request) {
  const authorization = await autorizarApi(request, "usuarios", "visualizar");
  if ("response" in authorization) return authorization.response;
  try {
    const searchParams = new URL(request.url).searchParams;
    const busca = (searchParams.get("busca") ?? searchParams.get("search") ?? searchParams.get("q"))?.trim();
    const unidadeId = searchParams.get("unidadeId") ?? searchParams.get("unidade");
    const cargoId = searchParams.get("cargoId") ?? searchParams.get("cargo");
    const perfilId = searchParams.get("perfilId") ?? searchParams.get("perfil");
    const status = searchParams.get("status") ??
      (searchParams.get("ativo") === "true" ? "ativo" : searchParams.get("ativo") === "false" ? "inativo" : null);

    if (status && status !== "ativo" && status !== "inativo") {
      return NextResponse.json({ error: "Filtro de status inválido." }, { status: 400 });
    }

    const usuarios = await obterPrisma().user.findMany({
      where: {
        ...(busca
          ? {
              OR: [
                { nome: { contains: busca, mode: "insensitive" } },
                { email: { contains: busca, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(unidadeId ? { unidadeId } : {}),
        ...(cargoId ? { cargoId } : {}),
        ...(perfilId ? { perfilId } : {}),
        ...(status ? { ativo: status === "ativo" } : {}),
      },
      select: usuarioSelect,
      orderBy: [{ nome: "asc" }, { email: "asc" }],
    });

    return NextResponse.json({ usuarios });
  } catch (error) {
    console.error("Falha ao listar usuários:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar os usuários." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await autorizarApi(request, "usuarios", "criar");
  if ("response" in authorization) return authorization.response;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    }

    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const senha = typeof body.senha === "string" ? body.senha : "";

    if (!nome || nome.length > 160 || !isValidEmail(email) || !senha || senha.length < 8) {
      return NextResponse.json(
        { error: "Informe nome, e-mail válido e senha com pelo menos 8 caracteres." },
        { status: 400 },
      );
    }
    if (!isValidPasswordLength(senha)) {
      return NextResponse.json(
        { error: "A senha não pode exceder 72 bytes." },
        { status: 400 },
      );
    }

    const relationIds = readRelationIds(body);
    if (!relationIds) {
      return NextResponse.json({ error: "Uma ou mais relações informadas são inválidas." }, { status: 400 });
    }

    const prisma = obterPrisma();
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json({ error: "Já existe um usuário cadastrado com esse e-mail." }, { status: 409 });
    }
    const relationError = await validateRelations(prisma, relationIds);
    if (relationError) {
      return NextResponse.json({ error: relationError }, { status: 400 });
    }
    if (relationIds.perfilId) {
      const targetProfile = await prisma.profile.findUnique({
        where: { id: relationIds.perfilId },
        select: {
          administradorTotal: true,
          permissoes: {
            select: {
              verMenu: true,
              visualizar: true,
              criar: true,
              editar: true,
              excluir: true,
              recurso: { select: { slug: true } },
            },
          },
        },
      });
      if (
        !targetProfile ||
        (targetProfile.administradorTotal && !authorization.user.permissoes.administradorTotal) ||
        !canGrantPermissions(
          authorization.user.permissoes,
          toGrantablePermissions(targetProfile.permissoes),
        )
      ) {
        return NextResponse.json(
          { error: "Não é permitido atribuir um perfil com permissões superiores às suas." },
          { status: 403 },
        );
      }
    }

    const senhaHash = await hash(senha, 12);
    const usuario = await prisma.user.create({
      data: { nome, email, senhaHash, ...relationIds, ativo: true },
      select: usuarioSelect,
    });

    return NextResponse.json({ usuario }, { status: 201 });
  } catch (error) {
    console.error("Falha ao cadastrar usuário:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    if (getDatabaseErrorCode(error) === "P2002") {
      return NextResponse.json({ error: "Já existe um usuário cadastrado com esse e-mail." }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível cadastrar o usuário." }, { status: 500 });
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
