import { NextResponse } from "next/server";
import { autorizarApi } from "@/lib/api-auth";
import { obterPrisma } from "@/lib/prisma";
import { canGrantPermissions } from "@/lib/rbac";
import {
  catalogoPermissoes,
  lerPermissoes,
} from "@/lib/permissoes";

async function garantirCatalogo(prisma: ReturnType<typeof obterPrisma>) {
  const recursosCanonicos = new Map<string, string>();

  for (const moduleDefinition of catalogoPermissoes) {
    const savedModule = await prisma.module.upsert({
      where: { slug: moduleDefinition.slug },
      create: {
        nome: moduleDefinition.nome,
        slug: moduleDefinition.slug,
        ordem: moduleDefinition.ordem,
      },
      update: { nome: moduleDefinition.nome, ordem: moduleDefinition.ordem },
    });

    for (const resource of moduleDefinition.recursos) {
      const savedResource = await prisma.resource.upsert({
        where: {
          moduleId_slug: { moduleId: savedModule.id, slug: resource.slug },
        },
        create: {
          nome: resource.nome,
          slug: resource.slug,
          moduleId: savedModule.id,
        },
        update: { nome: resource.nome },
      });
      recursosCanonicos.set(resource.slug, savedResource.id);
    }
  }

  const recursosLegados = await prisma.resource.findMany({
    where: { slug: { in: [...recursosCanonicos.keys()] } },
    select: { id: true, slug: true },
  });
  const recursosMovidos = recursosLegados.filter(
    (resource) => recursosCanonicos.get(resource.slug) !== resource.id,
  );

  if (recursosMovidos.length > 0) {
    const idsLegados = recursosMovidos.map(({ id }) => id);
    const permissoesLegadas = await prisma.profilePermission.findMany({
      where: { recursoId: { in: idsLegados } },
      select: {
        profileId: true,
        recursoId: true,
        verMenu: true,
        visualizar: true,
        criar: true,
        editar: true,
        excluir: true,
      },
    });
    const recursosMovidosPorId = new Map<string, string>(
      recursosMovidos.map(({ id, slug }) => [id, slug]),
    );
    const permissoesMigradas = permissoesLegadas.flatMap((permission) => {
      const slug = recursosMovidosPorId.get(permission.recursoId);
      const recursoId = slug && recursosCanonicos.get(slug);
      return recursoId ? [{ ...permission, recursoId }] : [];
    });

    if (permissoesMigradas.length > 0) {
      await prisma.profilePermission.createMany({
        data: permissoesMigradas,
        skipDuplicates: true,
      });
    }
    await prisma.resource.deleteMany({ where: { id: { in: idsLegados } } });
  }
}

export async function GET(request: Request) {
  const authorization = await autorizarApi(request, "perfis", "visualizar");
  if ("response" in authorization) return authorization.response;
  try {
    const prisma = obterPrisma();
    await garantirCatalogo(prisma);
    const [perfis, modulosDoBanco] = await Promise.all([
      prisma.profile.findMany({
        orderBy: { nome: "asc" },
        include: {
          permissoes: {
            select: {
              recursoId: true,
              verMenu: true,
              visualizar: true,
              criar: true,
              editar: true,
              excluir: true,
            },
          },
          _count: { select: { usuarios: true } },
        },
      }),
      prisma.module.findMany({
        where: { slug: { in: catalogoPermissoes.map(({ slug }) => slug) } },
        orderBy: { ordem: "asc" },
        include: { recursos: { orderBy: { nome: "asc" } } },
      }),
    ]);
    const modulos = modulosDoBanco.map((module) => {
      const catalogModule = catalogoPermissoes.find(({ slug }) => slug === module.slug);
      const resourceOrder = new Map<string, number>(
        catalogModule?.recursos.map(({ slug }, index) => [slug, index]) ?? [],
      );

      return {
        ...module,
        recursos: module.recursos
          .filter((resource) => resourceOrder.has(resource.slug))
          .sort(
            (left, right) =>
              (resourceOrder.get(left.slug) ?? 0) -
              (resourceOrder.get(right.slug) ?? 0),
          ),
      };
    });

    return NextResponse.json({ perfis, modulos });
  } catch (error) {
    console.error("Falha ao carregar perfis e permissões:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar os perfis e permissões." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await autorizarApi(request, "perfis", "criar");
  if ("response" in authorization) return authorization.response;
  try {
    const prisma = obterPrisma();
    await garantirCatalogo(prisma);
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const nome = typeof input.nome === "string" ? input.nome.trim() : "";
    if ("descricao" in input && typeof input.descricao !== "string") {
      return NextResponse.json({ error: "A descrição do perfil é inválida." }, { status: 400 });
    }
    if ("administradorTotal" in input && typeof input.administradorTotal !== "boolean") {
      return NextResponse.json({ error: "A flag de administrador total é inválida." }, { status: 400 });
    }
    const administradorTotal = input.administradorTotal === true;
    if (administradorTotal && !authorization.user.permissoes.administradorTotal) {
      return NextResponse.json(
        { error: "Somente um administrador total pode conceder esse nível de acesso." },
        { status: 403 },
      );
    }
    const descricao = typeof input.descricao === "string" ? input.descricao.trim() : "";
    const permissoes = lerPermissoes(input.permissoes);

    if (!nome || nome.length > 80 || descricao.length > 240 || !permissoes) {
      return NextResponse.json(
        { error: "Informe um nome, uma descrição válida e permissões válidas." },
        { status: 400 },
      );
    }

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
    const slugById = new Map(recursos.map(({ id, slug }) => [id, slug]));
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

    const perfil = await prisma.profile.create({
      data: {
        nome,
        descricao: descricao || null,
        administradorTotal,
        permissoes: {
          createMany: { data: permissoes },
        },
      },
      include: {
        permissoes: true,
        _count: { select: { usuarios: true } },
      },
    });
    return NextResponse.json(perfil, { status: 201 });
  } catch (error) {
    console.error("Falha ao criar perfil:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    const duplicate = isUniqueConstraintError(error);
    return NextResponse.json(
      {
        error: duplicate
          ? "Já existe um perfil com esse nome."
          : "Não foi possível criar o perfil.",
      },
      { status: duplicate ? 409 : 500 },
    );
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return getDatabaseErrorCode(error) === "P2002";
}

function getDatabaseErrorCode(error: unknown): unknown {
  return typeof error === "object" && error !== null && "code" in error
    ? error.code
    : undefined;
}
