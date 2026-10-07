export const catalogoPermissoes = [
  {
    nome: "Visão Geral",
    slug: "visao-geral",
    ordem: 0,
    recursos: [{ nome: "Visão geral (Painel / Dashboard)", slug: "painel" }],
  },
  {
    nome: "Tarefas",
    slug: "tarefas",
    ordem: 1,
    recursos: [
      { nome: "Minhas Tarefas", slug: "minhas-tarefas" },
      { nome: "Todas as Tarefas", slug: "tarefas" },
      { nome: "Quadro Kanban", slug: "kanban" },
    ],
  },
  {
    nome: "Operações e Análises",
    slug: "analises",
    ordem: 2,
    recursos: [{ nome: "Relatórios", slug: "relatorios" }],
  },
  {
    nome: "Reuniões & Súmulas",
    slug: "reunioes",
    ordem: 3,
    recursos: [
      { nome: "Agendas", slug: "reunioes" },
      { nome: "Súmulas", slug: "sumulas" },
      { nome: "Decisões", slug: "decisoes" },
    ],
  },
  {
    nome: "Configurações",
    slug: "gestao",
    ordem: 4,
    recursos: [
      { nome: "Usuários", slug: "usuarios" },
      { nome: "Perfis e permissões", slug: "perfis" },
      { nome: "Unidades", slug: "unidades" },
      { nome: "Cargos", slug: "cargos" },
      { nome: "Categorias", slug: "categorias" },
      { nome: "Configurações gerais", slug: "configuracoes" },
    ],
  },
] as const;

export const acoesPermissao = [
  "verMenu",
  "visualizar",
  "criar",
  "editar",
  "excluir",
] as const;

export type AcaoPermissao = (typeof acoesPermissao)[number];

export type PermissaoInput = {
  recursoId: string;
} & Record<AcaoPermissao, boolean>;

export function lerPermissoes(value: unknown): PermissaoInput[] | null {
  if (!Array.isArray(value)) return null;

  const result: PermissaoInput[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return null;
    }

    const permission = item as Record<string, unknown>;
    if (
      typeof permission.recursoId !== "string" ||
      permission.recursoId.length === 0 ||
      seen.has(permission.recursoId) ||
      !acoesPermissao.every((action) => typeof permission[action] === "boolean")
    ) {
      return null;
    }

    seen.add(permission.recursoId);
    result.push({
      recursoId: permission.recursoId,
      verMenu: permission.verMenu as boolean,
      visualizar: permission.visualizar as boolean,
      criar: permission.criar as boolean,
      editar: permission.editar as boolean,
      excluir: permission.excluir as boolean,
    });
  }

  return result;
}
