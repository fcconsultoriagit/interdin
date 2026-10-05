import { NextResponse } from "next/server";
import { autorizarApi } from "@/lib/api-auth";
import { canGrantPermissions, toGrantablePermissions } from "@/lib/rbac";
import { obterPrisma } from "@/lib/prisma";
import { lerPermissoes } from "@/lib/permissoes";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await autorizarApi(request, "perfis", "editar");
  if ("response" in authorization) return authorization.response;
  const { id } = await params;

  try {
    const prisma = obterPrisma();
    const existingProfile = await prisma.profile.findUnique({
      where: { id },
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
    if (!existingProfile) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }
    if (existingProfile.administradorTotal && !authorization.user.permissoes.administradorTotal) {
      return NextResponse.json(
        { error: "Somente um administrador total pode administrar esse perfil." },
        { status: 403 },
      );
    }
    if (!canGrantPermissions(authorization.user.permissoes, toGrantablePermissions(existingProfile.permissoes))) {
      return NextResponse.json(
        { error: "Seu perfil não pode administrar um perfil com permissões superiores." },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    if (Object.keys(input).length === 0) {
      return NextResponse.json({ error: "Informe ao menos um campo para atualizar." }, { status: 400 });
    }

    const data: {
      nome?: string;
      descricao?: string | null;
      ativo?: boolean;
      administradorTotal?: boolean;
    } = {};
    if ("nome" in input) {
      const nome = typeof input.nome === "string" ? input.nome.trim() : "";
      if (!nome || nome.length > 80) {
        return NextResponse.json({ error: "O nome do perfil é inválido." }, { status: 400 });
      }
      data.nome = nome;
    }
    if ("descricao" in input) {
      if (typeof input.descricao !== "string" || input.descricao.length > 240) {
        return NextResponse.json({ error: "A descrição do perfil é inválida." }, { status: 400 });
      }
      data.descricao = input.descricao.trim() || null;
    }
    if ("ativo" in input) {
      if (typeof input.ativo !== "boolean") {
        return NextResponse.json({ error: "O estado do perfil é inválido." }, { status: 400 });
      }
      data.ativo = input.ativo;
    }
    if ("administradorTotal" in input) {
      if (typeof input.administradorTotal !== "boolean") {
        return NextResponse.json({ error: "A flag de administrador total é inválida." }, { status: 400 });
      }
      if (input.administradorTotal && !authorization.user.permissoes.administradorTotal) {
        return NextResponse.json(
          { error: "Somente um administrador total pode conceder esse nível de acesso." },
          { status: 403 },
        );
      }
      data.administradorTotal = input.administradorTotal;
    }

    const permissoes = "permissoes" in input ? lerPermissoes(input.permissoes) : undefined;
    if ("permissoes" in input && !permissoes) {
      return NextResponse.json({ error: "As permissões informadas são inválidas." }, { status: 400 });
    }

    if (permissoes) {
      const recursos = await prisma.resource.findMany({
        where: { id: { in: permissoes.map(({ recursoId }) => recursoId) } },
        select: { id: true, slug: true },
      });
      if (recursos.length !== permissoes.length) {
        return NextResponse.json(
          { error: "Uma ou mais permissões referenciam recursos inexistentes." },
          { status: 400 },
        );
      }
      const slugById = new Map(recursos.map(({ id: resourceId, slug }) => [resourceId, slug]));
      const grantedPermissions = permissoes.map(({ recursoId, ...values }) => ({
        resourceKey: slugById.get(recursoId) ?? "",
        permissions: values,
      }));
      if (!canGrantPermissions(authorization.user.permissoes, grantedPermissions)) {
        return NextResponse.json(
          { error: "Não é permitido conceder ações que seu próprio perfil não possui." },
          { status: 403 },
        );
      }
    }

    const perfil = await prisma.$transaction(async (transaction) => {
      if (permissoes) {
        await transaction.profilePermission.deleteMany({ where: { profileId: id } });
      }
      return transaction.profile.update({
        where: { id },
        data: {
          ...data,
          ...(permissoes
            ? {
                permissoes: {
                  createMany: { data: permissoes },
                },
              }
            : {}),
        },
        include: {
          permissoes: true,
          _count: { select: { usuarios: true } },
        },
      });
    });

    return NextResponse.json(perfil);
  } catch (error) {
    console.error("Falha ao atualizar perfil:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    if (getDatabaseErrorCode(error) === "P2002") {
      return NextResponse.json({ error: "Já existe um perfil com esse nome." }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Não foi possível atualizar o perfil." },
      { status: getDatabaseErrorCode(error) === "P2025" ? 404 : 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const authorization = await autorizarApi(request, "perfis", "excluir");
  if ("response" in authorization) return authorization.response;
  const { id } = await params;

  try {
    const prisma = obterPrisma();
    const existingProfile = await prisma.profile.findUnique({
      where: { id },
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
    if (!existingProfile) {
      return NextResponse.json({ error: "Não foi possível excluir o perfil." }, { status: 404 });
    }
    if (existingProfile.administradorTotal && !authorization.user.permissoes.administradorTotal) {
      return NextResponse.json(
        { error: "Somente um administrador total pode excluir esse perfil." },
        { status: 403 },
      );
    }
    if (!canGrantPermissions(authorization.user.permissoes, toGrantablePermissions(existingProfile.permissoes))) {
      return NextResponse.json(
        { error: "Seu perfil não pode excluir um perfil com permissões superiores." },
        { status: 403 },
      );
    }
    await prisma.profile.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Falha ao excluir perfil:", error);
    return NextResponse.json(
      { error: "Não foi possível excluir o perfil." },
      { status: getDatabaseErrorCode(error) === "P2025" ? 404 : 500 },
    );
  }
}

function getDatabaseErrorCode(error: unknown): unknown {
  return typeof error === "object" && error !== null && "code" in error
    ? error.code
    : undefined;
}
