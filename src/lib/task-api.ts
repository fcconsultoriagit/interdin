import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { AuthenticatedUser } from "@/lib/rbac";

export const taskStatuses = [
  "NAO_INICIADO",
  "EM_ANDAMENTO",
  "PENDENTE_COORDENACAO",
  "CONCLUIDO",
  "ARQUIVADA",
] as const;
export const taskPriorities = ["BAIXA", "MEDIA", "ALTA", "URGENTE"] as const;

export const listSelect = {
  id: true,
  numero: true,
  codigo: true,
  titulo: true,
  descricao: true,
  notasImportantes: true,
  privada: true,
  status: true,
  prioridade: true,
  categoria: true,
  categoriaId: true,
  category: { select: { id: true, sigla: true, nome: true, cor: true } },
  progresso: true,
  prazo: true,
  dataTarefa: true,
  responsavelId: true,
  criadorId: true,
  unidadeId: true,
  unidadesCompartilhadas: true,
  colaboradoresIds: true,
  createdAt: true,
  updatedAt: true,
  responsavel: { select: { id: true, nome: true } },
  criador: { select: { id: true, nome: true } },
  unidade: { select: { id: true, nome: true, sigla: true } },
  _count: { select: { anexos: true } },
} satisfies Prisma.TaskSelect;

export function taskWithAttachmentCount(
  task: Prisma.TaskGetPayload<{ select: typeof listSelect }>,
) {
  const { _count, ...fields } = task;
  return { ...fields, anexosCount: _count.anexos };
}

export function taskVisibilityWhere(userId: string, unitId: string | null): Prisma.TaskWhereInput {
  return {
    OR: [
      { criadorId: userId },
      { responsavelId: userId },
      { colaboradoresIds: { has: userId } },
      {
        privada: false,
        unidadeId: null,
        unidadesCompartilhadas: { isEmpty: true },
      },
      ...(unitId
        ? [
            { privada: false, unidadeId: unitId },
            { privada: false, unidadesCompartilhadas: { has: unitId } },
          ]
        : []),
    ],
  };
}

export type TaskInput = {
  titulo: string;
  descricao: string | null;
  notasImportantes: string | null;
  privada: boolean;
  status: string;
  prioridade: string;
  categoria: string | null;
  categoriaId: string | null;
  progresso: number;
  prazo: Date | null;
  dataTarefa: Date;
  responsavelId: string | null;
  unidadeId: string | null;
  unidadesCompartilhadas: string[];
  colaboradoresIds: string[];
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isOneOf<const T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.some((candidate) => candidate === value);
}

export function parsePositiveInteger(value: string | null, fallback: number): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseDate(value: string | null): Date | null | false {
  if (value === null || value === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? false : parsed;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function parseTaskInput(
  body: Record<string, unknown>,
  partial: boolean,
): { data: Partial<TaskInput> } | { error: string } {
  const data: Partial<TaskInput> = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);

  if (!partial || has("titulo")) {
    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
    if (!titulo || titulo.length > 240) return { error: "Informe um título válido com até 240 caracteres." };
    data.titulo = titulo;
  }
  if (has("descricao")) {
    if (body.descricao !== null && typeof body.descricao !== "string") return { error: "A descrição é inválida." };
    if (typeof body.descricao === "string" && body.descricao.length > 20000) return { error: "A descrição deve ter no máximo 20.000 caracteres." };
    data.descricao = typeof body.descricao === "string" ? body.descricao.trim() || null : null;
  }
  if (has("notasImportantes")) {
    if (body.notasImportantes !== null && typeof body.notasImportantes !== "string") return { error: "As notas importantes são inválidas." };
    if (typeof body.notasImportantes === "string" && body.notasImportantes.length > 20000) return { error: "As notas importantes devem ter no máximo 20.000 caracteres." };
    data.notasImportantes = typeof body.notasImportantes === "string" ? body.notasImportantes.trim() || null : null;
  }
  if (has("privada")) {
    if (typeof body.privada !== "boolean") return { error: "A opção de privacidade é inválida." };
    data.privada = body.privada;
  } else if (!partial) data.privada = false;
  if (has("status")) {
    if (typeof body.status !== "string" || !isOneOf(taskStatuses, body.status)) return { error: "O status informado é inválido." };
    data.status = body.status;
  } else if (!partial) data.status = "NAO_INICIADO";
  if (has("prioridade")) {
    if (typeof body.prioridade !== "string" || !isOneOf(taskPriorities, body.prioridade)) return { error: "A prioridade informada é inválida." };
    data.prioridade = body.prioridade;
  } else if (!partial) data.prioridade = "MEDIA";
  if (has("categoria")) {
    if (body.categoria !== null && typeof body.categoria !== "string") return { error: "A categoria informada é inválida." };
    const categoria = typeof body.categoria === "string" ? body.categoria.trim() : "";
    if (categoria.length > 100) return { error: "A categoria deve ter no máximo 100 caracteres." };
    data.categoria = categoria || null;
  }
  if (has("categoriaId")) {
    if (body.categoriaId !== null && (typeof body.categoriaId !== "string" || !body.categoriaId)) {
      return { error: "A categoria informada é inválida." };
    }
    data.categoriaId = typeof body.categoriaId === "string" ? body.categoriaId : null;
  } else if (!partial) data.categoriaId = null;
  if (has("progresso")) {
    if (typeof body.progresso !== "number" || !Number.isInteger(body.progresso) || body.progresso < 0 || body.progresso > 100) {
      return { error: "O progresso deve ser um número inteiro de 0 a 100." };
    }
    data.progresso = body.progresso;
  } else if (!partial) data.progresso = 0;
  if (has("prazo")) {
    if (body.prazo !== null && typeof body.prazo !== "string") return { error: "O prazo informado é inválido." };
    const prazo = parseDate(typeof body.prazo === "string" ? body.prazo : null);
    if (prazo === false) return { error: "O prazo informado é inválido." };
    data.prazo = prazo;
  }
  if (has("dataTarefa")) {
    if (typeof body.dataTarefa !== "string") return { error: "A data da tarefa é inválida." };
    const date = parseDate(body.dataTarefa);
    if (date === null || date === false) return { error: "A data da tarefa é inválida." };
    data.dataTarefa = date;
  }
  if (has("responsavelId")) {
    if (body.responsavelId !== null && (typeof body.responsavelId !== "string" || !body.responsavelId)) {
      return { error: "O responsável informado é inválido." };
    }
    data.responsavelId = typeof body.responsavelId === "string" ? body.responsavelId : null;
  }
  if (has("unidadeId")) {
    if (body.unidadeId !== null && (typeof body.unidadeId !== "string" || !body.unidadeId)) {
      return { error: "A unidade principal informada é inválida." };
    }
    data.unidadeId = typeof body.unidadeId === "string" ? body.unidadeId : null;
  } else if (!partial) data.unidadeId = null;
  for (const key of ["unidadesCompartilhadas", "colaboradoresIds"] as const) {
    if (has(key)) {
      const value = body[key];
      if (!isUniqueStringArray(value)) {
        return {
          error: key === "unidadesCompartilhadas"
            ? "A lista de unidades compartilhadas é inválida."
            : "A lista de colaboradores é inválida.",
        };
      }
      data[key] = value;
    } else if (!partial) data[key] = [];
  }

  if (partial && Object.keys(data).length === 0) return { error: "Informe ao menos um campo para atualizar." };
  return { data };
}

export async function taskDataWithCategory(
  prisma: PrismaClient,
  data: Partial<TaskInput>,
): Promise<{ data: Partial<TaskInput> } | { error: string }> {
  if (!Object.prototype.hasOwnProperty.call(data, "categoriaId")) return { data };
  if (!data.categoriaId) return { data: { ...data, categoria: null } };

  const category = await prisma.category.findUnique({
    where: { id: data.categoriaId },
    select: { sigla: true, nome: true, ativa: true },
  });
  if (!category || !category.ativa) return { error: "A categoria selecionada não existe ou está inativa." };

  return { data: { ...data, categoria: `[${category.sigla}] ${category.nome}` } };
}

export function applyTaskGovernance(
  data: Partial<TaskInput>,
  actor: Pick<AuthenticatedUser, "id" | "podeAtribuirParaOutros" | "podeConvidarColaboradores">,
  partial: boolean,
): { data: Partial<TaskInput> } | { error: string } {
  const result = { ...data };

  if (!actor.podeAtribuirParaOutros) {
    if (
      Object.prototype.hasOwnProperty.call(result, "responsavelId") &&
      result.responsavelId !== actor.id &&
      (partial || result.responsavelId !== null)
    ) {
      return { error: "Você não tem permissão para atribuir tarefas a outros usuários." };
    }
    if (!partial) result.responsavelId = actor.id;
  }
  if (!actor.podeConvidarColaboradores) {
    if ((result.colaboradoresIds?.length ?? 0) > 0) {
      return { error: "Você não tem permissão para convidar colaboradores para tarefas." };
    }
    if (partial && Object.prototype.hasOwnProperty.call(result, "colaboradoresIds")) {
      return { error: "Você não tem permissão para alterar os colaboradores da tarefa." };
    }
    if (!partial) result.colaboradoresIds = [];
  }
  if (
    result.responsavelId &&
    result.colaboradoresIds?.includes(result.responsavelId)
  ) {
    return { error: "O responsável principal não pode também ser colaborador da tarefa." };
  }

  return { data: result };
}

export async function validateTaskRelations(
  prisma: PrismaClient,
  data: Partial<TaskInput>,
  actorId: string,
): Promise<string | null> {
  const userIds = new Set<string>([
    ...(data.responsavelId ? [data.responsavelId] : []),
    ...(data.colaboradoresIds ?? []),
    actorId,
  ]);
  const unitIds = new Set<string>([
    ...(data.unidadeId ? [data.unidadeId] : []),
    ...(data.unidadesCompartilhadas ?? []),
  ]);
  const [users, units] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: [...userIds] }, ativo: true },
      select: { id: true },
    }),
    prisma.unidade.findMany({
      where: { id: { in: [...unitIds] }, ativo: true },
      select: { id: true },
    }),
  ]);
  if (users.length !== userIds.size) return "O responsável ou um colaborador não existe ou está inativo.";
  if (units.length !== unitIds.size) return "A unidade principal ou uma unidade compartilhada não existe ou está inativa.";
  return null;
}

function isUniqueStringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.length <= 100 &&
    value.every((item): item is string => typeof item === "string" && item.length > 0) &&
    new Set(value).size === value.length;
}
