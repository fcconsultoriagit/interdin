import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { autorizarApi } from "@/lib/api-auth";
import { obterPrisma } from "@/lib/prisma";
import {
  isOneOf,
  isRecord,
  listSelect,
  addDays,
  applyTaskGovernance,
  parseDate,
  parsePositiveInteger,
  parseTaskInput,
  taskDataWithCategory,
  taskStatuses,
  taskVisibilityWhere,
  validateTaskRelations,
} from "@/lib/task-api";

export async function GET(request: Request) {
  const authorization = await autorizarApi(request, "tarefas", "visualizar");
  if ("response" in authorization) return authorization.response;

  try {
    const searchParams = new URL(request.url).searchParams;
    const page = parsePositiveInteger(searchParams.get("pagina") ?? searchParams.get("page"), 1);
    const pageSize = parsePositiveInteger(searchParams.get("porPagina") ?? searchParams.get("pageSize"), 12);
    if (!page || !pageSize || pageSize > 100) {
      return NextResponse.json({ error: "Os parâmetros de paginação são inválidos." }, { status: 400 });
    }

    const status = searchParams.get("status");
    if (status && !isOneOf(taskStatuses, status)) {
      return NextResponse.json({ error: "O filtro de status é inválido." }, { status: 400 });
    }
    const hideArchived = searchParams.get("ocultarArquivadas");
    if (hideArchived !== null && hideArchived !== "true" && hideArchived !== "false") {
      return NextResponse.json({ error: "O filtro de tarefas arquivadas é inválido." }, { status: 400 });
    }
    const fromDate = parseDate(searchParams.get("dataDe"));
    const untilDate = parseDate(searchParams.get("dataAte"));
    if (fromDate === false || untilDate === false) {
      return NextResponse.json({ error: "O intervalo de datas é inválido." }, { status: 400 });
    }
    if (fromDate && untilDate && fromDate.getTime() > untilDate.getTime()) {
      return NextResponse.json({ error: "A data inicial não pode ser posterior à data final." }, { status: 400 });
    }
    if ((searchParams.get("busca")?.trim().length ?? 0) > 240) {
      return NextResponse.json({ error: "A busca deve ter no máximo 240 caracteres." }, { status: 400 });
    }

    const visibilityWhere = taskVisibilityWhere(
      authorization.user.id,
      authorization.user.unidadeId,
    );
    const filters: Prisma.TaskWhereInput[] = [];
    const search = searchParams.get("busca")?.trim();
    if (search) {
      filters.push({
        OR: [
          { titulo: { contains: search, mode: "insensitive" } },
          { codigo: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (status) filters.push({ status });
    if (hideArchived === "true") filters.push({ status: { not: "ARQUIVADA" } });
    const categoria = searchParams.get("categoria");
    if (categoria) {
      filters.push({
        OR: [{ categoriaId: categoria }, { categoria }],
      });
    }
    const responsavelId = searchParams.get("responsavelId");
    if (responsavelId) filters.push({ responsavelId });
    const unidadeId = searchParams.get("unidadeId");
    if (unidadeId) {
      filters.push({
        OR: [
          { unidadeId },
          { unidadesCompartilhadas: { has: unidadeId } },
        ],
      });
    }
    if (fromDate || untilDate) {
      filters.push({
        createdAt: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(untilDate ? { lt: addDays(untilDate, 1) } : {}),
        },
      });
    }
    const where: Prisma.TaskWhereInput = { AND: [visibilityWhere, ...filters] };
    const countFilters = status
      ? filters.filter((filter) => !("status" in filter) || typeof filter.status === "object")
      : filters;
    const countWhere: Prisma.TaskWhereInput = { AND: [visibilityWhere, ...countFilters] };
    const prisma = obterPrisma();
    const [tarefas, total, statusGroups, usuarios, unidades, categorias] = await Promise.all([
      prisma.task.findMany({
        where,
        select: listSelect,
        orderBy: [{ prazo: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.task.count({ where }),
      prisma.task.groupBy({
        by: ["status"],
        where: countWhere,
        _count: { _all: true },
      }),
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

    const contagens = Object.fromEntries(taskStatuses.map((item) => [item, 0])) as Record<
      (typeof taskStatuses)[number],
      number
    >;
    for (const group of statusGroups) {
      if (isOneOf(taskStatuses, group.status)) contagens[group.status] = group._count._all;
    }

    const tarefasComCategoriaNula = tarefas.map((tarefa) => ({
      ...tarefa,
      category: tarefa.category ?? null,
    }));

    return NextResponse.json({
      tarefas: tarefasComCategoriaNula,
      pagina: page,
      porPagina: pageSize,
      total,
      paginas: Math.ceil(total / pageSize),
      contagens,
      opcoes: {
        usuarios,
        unidades,
        categorias,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao listar tarefas:", error);
    return NextResponse.json({ error: "Não foi possível carregar as tarefas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await autorizarApi(request, "tarefas", "criar");
  if ("response" in authorization) return authorization.response;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    }
    const parsed = parseTaskInput(body, false);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const titulo = parsed.data.titulo;
    if (!titulo) return NextResponse.json({ error: "Informe um título para a tarefa." }, { status: 400 });

    const prisma = obterPrisma();
    const governedData = applyTaskGovernance(parsed.data, authorization.user, false);
    if ("error" in governedData) return NextResponse.json({ error: governedData.error }, { status: 403 });
    const taskData = await taskDataWithCategory(prisma, governedData.data);
    if ("error" in taskData) {
      return NextResponse.json({ error: taskData.error }, { status: 400 });
    }
    const relationError = await validateTaskRelations(prisma, governedData.data, authorization.user.id);
    if (relationError) {
      return NextResponse.json({ error: relationError }, { status: 400 });
    }
    const tarefa = await prisma.$transaction(async (transaction) => {
      const created = await transaction.task.create({
        data: {
          ...taskData.data,
          titulo,
          criadorId: authorization.user.id,
          codigo: null,
        },
        select: { id: true, numero: true, dataTarefa: true },
      });
      const date = created.dataTarefa;
      const codigo = `#${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(created.numero).padStart(4, "0")}`;
      return transaction.task.update({
        where: { id: created.id },
        data: { codigo },
        select: listSelect,
      });
    }, { maxWait: 10000, timeout: 60000 });

    return NextResponse.json({ tarefa }, { status: 201 });
  } catch (error) {
    console.error("Falha ao criar tarefa:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    return NextResponse.json({ error: "Não foi possível criar a tarefa." }, { status: 500 });
  }
}
