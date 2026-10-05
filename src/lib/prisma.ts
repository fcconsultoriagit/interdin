import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prismaClient = globalThis as typeof globalThis & { prisma?: PrismaClient };

export function obterPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("Configure DATABASE_URL para conectar ao banco PostgreSQL.");
  }

  if (!prismaClient.prisma) {
    prismaClient.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return prismaClient.prisma;
}
