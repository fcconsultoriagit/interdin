import type { PrismaClient } from "@prisma/client";

export type RelationIds = {
  unidadeId?: string | null;
  cargoId?: string | null;
  perfilId?: string | null;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readRelationIds(body: Record<string, unknown>): RelationIds | null {
  const fields = ["unidadeId", "cargoId", "perfilId"] as const;
  const ids: RelationIds = {};
  for (const field of fields) {
    const value = body[field];
    if (value === undefined) continue;
    if (value !== null && (typeof value !== "string" || value.length === 0)) return null;
    ids[field] = value;
  }
  return ids;
}

export async function validateRelations(
  prisma: PrismaClient,
  relations: RelationIds,
  currentRelations: RelationIds = {},
): Promise<string | null> {
  const [unidade, cargo, perfil] = await Promise.all([
    relations.unidadeId
      ? prisma.unidade.findFirst({
          where: {
            id: relations.unidadeId,
            ...(relations.unidadeId === currentRelations.unidadeId ? {} : { ativo: true }),
          },
          select: { id: true },
        })
      : null,
    relations.cargoId
      ? prisma.cargo.findFirst({
          where: {
            id: relations.cargoId,
            ...(relations.cargoId === currentRelations.cargoId ? {} : { ativo: true }),
          },
          select: { id: true },
        })
      : null,
    relations.perfilId
      ? prisma.profile.findFirst({
          where: {
            id: relations.perfilId,
            ...(relations.perfilId === currentRelations.perfilId ? {} : { ativo: true }),
          },
          select: { id: true },
        })
      : null,
  ]);

  if (relations.unidadeId && !unidade) return "A unidade selecionada não existe ou está inativa.";
  if (relations.cargoId && !cargo) return "O cargo selecionado não existe ou está inativo.";
  if (relations.perfilId && !perfil) return "O perfil selecionado não existe ou está inativo.";
  return null;
}
