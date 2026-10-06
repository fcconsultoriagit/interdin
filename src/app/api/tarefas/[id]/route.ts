import { NextResponse } from "next/server";
import { autorizarApi } from "@/lib/api-auth";
import { obterPrisma } from "@/lib/prisma";
import { applyTaskGovernance, isRecord, listSelect, parseTaskInput, taskDataWithCategory, taskVisibilityWhere, taskWithAttachmentCount, validateTaskRelations } from "@/lib/task-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const authorization = await autorizarApi(request, "tarefas", "visualizar");
  if ("response" in authorization) return authorization.response;
  const { id } = await params;

  try {
    const tarefa = await obterPrisma().task.findFirst({
      where: {
        id,
        ...taskVisibilityWhere(authorization.user.id, authorization.user.unidadeId),
      },
      select: listSelect,
    });
    if (!tarefa) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    return NextResponse.json({ tarefa: taskWithAttachmentCount(tarefa) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar tarefa:", error);
    return NextResponse.json({ error: "Não foi possível carregar a tarefa." }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  return updateTask(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return updateTask(request, context);
}

async function updateTask(request: Request, { params }: RouteContext) {
  const authorization = await autorizarApi(request, "tarefas", "editar");
  if ("response" in authorization) return authorization.response;
  const { id } = await params;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    const parsed = parseTaskInput(body, true);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const governedData = applyTaskGovernance(parsed.data, authorization.user, true);
    if ("error" in governedData) return NextResponse.json({ error: governedData.error }, { status: 403 });

    const prisma = obterPrisma();
    const existing = await prisma.task.findFirst({
      where: {
        id,
        ...taskVisibilityWhere(authorization.user.id, authorization.user.unidadeId),
      },
      select: { id: true, responsavelId: true },
    });
    if (!existing) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    const responsibleId = governedData.data.responsavelId ?? existing.responsavelId;
    if (responsibleId && governedData.data.colaboradoresIds?.includes(responsibleId)) {
      return NextResponse.json({ error: "O responsável principal não pode também ser colaborador da tarefa." }, { status: 400 });
    }

    const relationError = await validateTaskRelations(prisma, governedData.data, authorization.user.id);
    if (relationError) return NextResponse.json({ error: relationError }, { status: 400 });
    const taskData = await taskDataWithCategory(prisma, governedData.data);
    if ("error" in taskData) return NextResponse.json({ error: taskData.error }, { status: 400 });
    const tarefa = await prisma.task.update({
      where: { id },
      data: taskData.data,
      select: listSelect,
    });
    return NextResponse.json({ tarefa: taskWithAttachmentCount(tarefa) });
  } catch (error) {
    console.error("Falha ao atualizar tarefa:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    return NextResponse.json({ error: "Não foi possível atualizar a tarefa." }, { status: 500 });
  }
}
