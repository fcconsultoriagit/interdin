import { NextResponse } from "next/server";
import { obterPrisma } from "@/lib/prisma";
import {
  catalogoPermissoes,
  lerPermissoes,
} from "@/lib/permissoes";

async function garantirCatalogo(prisma: ReturnType<typeof obterPrisma>) {
  for (const module of catalogoPermissoes) {
    const savedModule = await prisma.module.upsert({
      where: { slug: module.slug },
      create: { nome: module.nome, slug: module.slug, ordem: module.ordem },
      update: { nome: module.nome, ordem: module.ordem },
    });

    for (const resource of module.recursos) {
      await prisma.resource.upsert({
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
    }

  }
}

export async function GET() {
  try {
    const prisma = obterPrisma();
    await garantirCatalogo(prisma);
    const [perfis, modulos] = await Promise.all([
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
        orderBy: { ordem: "asc" },
        include: { recursos: { orderBy: { nome: "asc" } } },
      }),
    ]);

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
      select: { id: true },
    });
    if (recursos.length !== permissoes.length) {
      return NextResponse.json(
        { error: "Uma ou mais permissões referenciam recursos inexistentes." },
        { status: 400 },
      );
    }

    const perfil = await prisma.profile.create({
      data: {
        nome,
        descricao: descricao || null,
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
