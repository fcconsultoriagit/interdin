import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

nextEnv.loadEnvConfig(process.cwd());

const email = "fdscosta@tjba.jus.br";
const password = process.env.ADMIN_SETUP_PASSWORD;
if (!password) {
  throw new Error("Defina ADMIN_SETUP_PASSWORD apenas para esta execução do setup.");
}

const envPath = join(process.cwd(), ".env");
const envText = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const authSecretLine = envText.match(/^\s*AUTH_SECRET\s*=\s*(.*)$/m);
let authSecret = authSecretLine?.[1]?.trim().replace(/^["']|["']$/g, "");

if (authSecretLine && !authSecret) {
  authSecret = randomBytes(48).toString("base64url");
  const updatedEnv = envText.replace(
    /^\s*AUTH_SECRET\s*=.*$/m,
    `AUTH_SECRET=${authSecret}`,
  );
  writeFileSync(envPath, updatedEnv, "utf8");
} else if (!authSecretLine) {
  authSecret = randomBytes(48).toString("base64url");
  const separator = envText.length > 0 && !envText.endsWith("\n") ? "\n" : "";
  writeFileSync(envPath, `${envText}${separator}AUTH_SECRET=${authSecret}\n`, "utf8");
}

if (!authSecret || authSecret.length < 32) {
  throw new Error("O AUTH_SECRET existente no .env precisa ter pelo menos 32 caracteres.");
}
process.env.AUTH_SECRET = authSecret;

const catalog = [
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
      { nome: "Colaborações", slug: "colaboracoes" },
    ],
  },
  {
    nome: "Operações e Análises",
    slug: "analises",
    ordem: 2,
    recursos: [{ nome: "Relatórios", slug: "relatorios" }],
  },
  {
    nome: "Configurações",
    slug: "gestao",
    ordem: 3,
    recursos: [
      { nome: "Usuários", slug: "usuarios" },
      { nome: "Perfis e permissões", slug: "perfis" },
      { nome: "Unidades", slug: "unidades" },
      { nome: "Cargos", slug: "cargos" },
      { nome: "Configurações gerais", slug: "configuracoes" },
    ],
  },
];

const prisma = new PrismaClient();
try {
  const passwordHash = await hash(password, 12);
  const result = await prisma.$transaction(async (transaction) => {
    const canonicalResourceIds = new Map();

    for (const moduleDefinition of catalog) {
      const savedModule = await transaction.module.upsert({
        where: { slug: moduleDefinition.slug },
        create: {
          nome: moduleDefinition.nome,
          slug: moduleDefinition.slug,
          ordem: moduleDefinition.ordem,
        },
        update: { nome: moduleDefinition.nome, ordem: moduleDefinition.ordem },
      });

      for (const resourceDefinition of moduleDefinition.recursos) {
        const resource = await transaction.resource.upsert({
          where: {
            moduleId_slug: {
              moduleId: savedModule.id,
              slug: resourceDefinition.slug,
            },
          },
          create: {
            nome: resourceDefinition.nome,
            slug: resourceDefinition.slug,
            moduleId: savedModule.id,
          },
          update: { nome: resourceDefinition.nome },
        });
        canonicalResourceIds.set(resourceDefinition.slug, resource.id);
      }
    }

    const legacyResources = await transaction.resource.findMany({
      where: { slug: { in: [...canonicalResourceIds.keys()] } },
      select: { id: true, slug: true },
    });
    const obsoleteResourceIds = legacyResources
      .filter(({ id, slug }) => canonicalResourceIds.get(slug) !== id)
      .map(({ id }) => id);

    if (obsoleteResourceIds.length > 0) {
      const legacyPermissions = await transaction.profilePermission.findMany({
        where: { recursoId: { in: obsoleteResourceIds } },
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
      const oldToCanonical = new Map(
        legacyResources
          .filter(({ id, slug }) => canonicalResourceIds.get(slug) !== id)
          .map(({ id, slug }) => [id, canonicalResourceIds.get(slug)]),
      );
      await transaction.profilePermission.createMany({
        data: legacyPermissions.flatMap((permission) => {
          const recursoId = oldToCanonical.get(permission.recursoId);
          return recursoId ? [{ ...permission, recursoId }] : [];
        }),
        skipDuplicates: true,
      });
      await transaction.resource.deleteMany({
        where: { id: { in: obsoleteResourceIds } },
      });
    }

    const profile = await transaction.profile.upsert({
      where: { nome: "Administrador" },
      create: {
        nome: "Administrador",
        descricao: "Perfil administrativo total.",
        ativo: true,
        administradorTotal: true,
      },
      update: { ativo: true, administradorTotal: true },
      select: { id: true },
    });

    const resourceIds = [...canonicalResourceIds.values()];
    await transaction.profilePermission.createMany({
      data: resourceIds.map((recursoId) => ({
        profileId: profile.id,
        recursoId,
        verMenu: true,
        visualizar: true,
        criar: true,
        editar: true,
        excluir: true,
      })),
      skipDuplicates: true,
    });
    await transaction.profilePermission.updateMany({
      where: { profileId: profile.id, recursoId: { in: resourceIds } },
      data: {
        verMenu: true,
        visualizar: true,
        criar: true,
        editar: true,
        excluir: true,
      },
    });

    const matchingUsers = await transaction.user.findMany({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
      take: 2,
    });
    if (matchingUsers.length > 1) {
      throw new Error(`Há mais de um usuário cadastrado com o e-mail ${email}.`);
    }

    if (matchingUsers.length === 1) {
      const user = await transaction.user.update({
        where: { id: matchingUsers[0].id },
        data: {
          email,
          senhaHash: passwordHash,
          ativo: true,
          perfilId: profile.id,
        },
        select: { id: true },
      });
      return { userId: user.id, created: false };
    }

    const user = await transaction.user.create({
      data: {
        nome: "Administrador Master",
        email,
        senhaHash: passwordHash,
        ativo: true,
        perfilId: profile.id,
      },
      select: { id: true },
    });
    return { userId: user.id, created: true };
  }, { maxWait: 10000, timeout: 60000 });

  console.log(
    `Setup concluído: ${result.created ? "usuário criado" : "usuário atualizado"}; perfil Administrador ativo com permissões totais.`,
  );
  console.log(`E-mail: ${email}`);
} finally {
  await prisma.$disconnect();
}
