import { NextResponse } from "next/server";
import { autorizarApi } from "@/lib/api-auth";
import { obterPrisma } from "@/lib/prisma";
import { listSelect } from "@/lib/task-api";

const activeTaskWhere = { status: { notIn: ["CONCLUIDO", "ARQUIVADA"] } };

export async function GET(request: Request) {
  const authorization = await autorizarApi(request, "minhas-tarefas", "visualizar");
  if ("response" in authorization) return authorization.response;

  try {
    const userId = authorization.user.id;
    const assignedWhere = {
      responsavelId: userId,
      criadorId: { not: userId },
      status: { not: "ARQUIVADA" },
    };
    const collaboratingWhere = { colaboradoresIds: { has: userId } };
    const createdWhere = { criadorId: userId };
    const prisma = obterPrisma();

    const [
      atribuídas,
      colaboracoes,
      criadas,
      atribuídasCount,
      colaboracoesCount,
      criadasCount,
      usuarios,
      unidades,
      categorias,
    ] = await Promise.all([
      prisma.task.findMany({
        where: assignedWhere,
        select: listSelect,
        orderBy: [{ prazo: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      }),
      prisma.task.findMany({
        where: collaboratingWhere,
        select: listSelect,
        orderBy: [{ prazo: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      }),
      prisma.task.findMany({
        where: createdWhere,
        select: listSelect,
        orderBy: [{ prazo: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      }),
      prisma.task.count({ where: { ...assignedWhere, ...activeTaskWhere } }),
      prisma.task.count({ where: { ...collaboratingWhere, ...activeTaskWhere } }),
      prisma.task.count({ where: { ...createdWhere, ...activeTaskWhere } }),
      prisma.user.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
      prisma.unidade.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, sigla: true },
        orderBy: { nome: "asc" },
      }),
      prisma.category.findMany({
        where: { ativa: true },
        select: { id: true, sigla: true, nome: true, cor: true },
        orderBy: { nome: "asc" },
      }),
    ]);

    return NextResponse.json({
      tarefas: {
        atribuídas,
        ondeColaboro: colaboracoes,
        criadasPorMim: criadas,
      },
      contagens: {
        atribuídas: atribuídasCount,
        ondeColaboro: colaboracoesCount,
        criadasPorMim: criadasCount,
      },
      opcoes: { usuarios, unidades, categorias },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar tarefas do usuário:", error);
    return NextResponse.json({ error: "Não foi possível carregar suas tarefas." }, { status: 500 });
  }
}
