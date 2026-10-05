import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { compare } from "bcryptjs";
import { cache } from "react";
import { cookies } from "next/headers";
import { obterPrisma } from "@/lib/prisma";
import { acoesPermissao, catalogoPermissoes } from "@/lib/permissoes";
import type { AuthenticatedUser, PermissionValues, UserPermissions } from "@/lib/rbac";

export const SESSION_COOKIE = "interdin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

type SessionPayload = { sub: string; exp: number };
type PermissionRow = {
  verMenu: boolean;
  visualizar: boolean;
  criar: boolean;
  editar: boolean;
  excluir: boolean;
  recurso: { slug: string };
};
type UserRecord = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  perfil: {
    nome: string;
    ativo: boolean;
    administradorTotal: boolean;
    permissoes: PermissionRow[];
  } | null;
};

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Configure AUTH_SECRET com pelo menos 32 caracteres para habilitar a autenticação.");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

export function criarTokenSessao(userId: string): string {
  const payload: SessionPayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function validarTokenSessao(token: string): string | null {
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) return null;

  let expectedSignature: string;
  try {
    expectedSignature = sign(encodedPayload);
  } catch {
    return null;
  }

  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString()) as unknown;
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("sub" in payload) ||
      typeof payload.sub !== "string" ||
      !("exp" in payload) ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}

function permissionsFromRows(rows: PermissionRow[], adminFlag: boolean): UserPermissions {
  const recursos: Record<string, PermissionValues> = {};
  for (const row of rows) {
    recursos[row.recurso.slug] = {
      verMenu: row.verMenu,
      visualizar: row.visualizar,
      criar: row.criar,
      editar: row.editar,
      excluir: row.excluir,
    };
  }

  const administradorTotal = adminFlag || catalogoPermissoes.every((module) =>
    module.recursos.every((resource) =>
      acoesPermissao.every((action) => recursos[resource.slug]?.[action] === true),
    ),
  );

  return { administradorTotal, recursos };
}

function userContext(user: UserRecord): AuthenticatedUser {
  const profile = user.perfil?.ativo ? user.perfil : null;
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfilNome: profile?.nome ?? null,
    permissoes: permissionsFromRows(profile?.permissoes ?? [], profile?.administradorTotal ?? false),
  };
}

async function findActiveUser(userId: string): Promise<AuthenticatedUser | null> {
  const user = await obterPrisma().user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nome: true,
      email: true,
      ativo: true,
      perfil: {
        select: {
          nome: true,
          ativo: true,
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
      },
    },
  });
  return user?.ativo ? userContext(user) : null;
}

export async function obterSessaoDaRequisicao(request: Request): Promise<AuthenticatedUser | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  if (!sessionCookie) return null;
  let token: string;
  try {
    token = decodeURIComponent(sessionCookie.slice(SESSION_COOKIE.length + 1));
  } catch {
    return null;
  }
  const userId = validarTokenSessao(token);
  return userId ? findActiveUser(userId) : null;
}

export async function autenticarUsuario(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const user = await obterPrisma().user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      nome: true,
      email: true,
      ativo: true,
      senhaHash: true,
      perfil: {
        select: {
          nome: true,
          ativo: true,
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
      },
    },
  });
  if (!user?.ativo || !(await compare(password, user.senhaHash))) return null;
  return userContext(user);
}

export const obterSessaoAtual = cache(async (): Promise<AuthenticatedUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = validarTokenSessao(token);
  return userId ? findActiveUser(userId) : null;
});

export const DURACAO_SESSAO_SEGUNDOS = SESSION_DURATION_SECONDS;
