import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());

const categories = [
  { sigla: "SEI", nome: "Processos", cor: "#2563EB" },
  { sigla: "PAG", nome: "Pagamentos", cor: "#16A34A" },
  { sigla: "TEL", nome: "Ativos (Telefonia)", cor: "#EA580C" },
  { sigla: "FISC", nome: "Fiscalização", cor: "#7E22CE" },
  { sigla: "PROJ", nome: "Projetos", cor: "#4F46E5" },
  { sigla: "EVE", nome: "Eventos", cor: "#DB2777" },
  { sigla: "ATV", nome: "Ativos (Equipamentos)", cor: "#0891B2" },
  { sigla: "DOC", nome: "Documentação", cor: "#D97706" },
  { sigla: "DEV", nome: "Sistemas", cor: "#0D9488" },
  { sigla: "REU", nome: "Reunião", cor: "#64748B" },
  { sigla: "PLAN", nome: "Planejamento", cor: "#1D4ED8" },
];

const prisma = new PrismaClient();
try {
  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { sigla: category.sigla },
      create: category,
      update: { nome: category.nome, cor: category.cor },
    });
    await prisma.task.updateMany({
      where: {
        categoriaId: null,
        categoria: { in: [category.nome, category.sigla, `[${category.sigla}] ${category.nome}`] },
      },
      data: { categoriaId: saved.id, categoria: `[${category.sigla}] ${category.nome}` },
    });
  }
  console.log(`${categories.length} categorias padrão sincronizadas.`);
} finally {
  await prisma.$disconnect();
}
