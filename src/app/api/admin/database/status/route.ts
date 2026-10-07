import { NextResponse } from "next/server";
import { authorizeDatabaseAdministration } from "@/lib/admin-database-auth";
import { describeConnectionError, getActiveConnectionSummary } from "@/lib/admin-database";
import { obterPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeDatabaseAdministration(request);
  if ("response" in authorization) return authorization.response;

  const connection = getActiveConnectionSummary();
  if (!connection) {
    return NextResponse.json({
      healthy: false,
      connection: null,
      error: "A conexão ativa do banco não está configurada corretamente no servidor.",
    }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await obterPrisma().$queryRaw<Array<{ version: string }>>`SELECT version()`;
    return NextResponse.json({
      healthy: true,
      connection,
      version: result[0]?.version ?? "Versão não informada.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao verificar a conexão ativa do PostgreSQL:", describeConnectionError(error));
    return NextResponse.json({
      healthy: false,
      connection,
      error: describeConnectionError(error),
    }, { headers: { "Cache-Control": "no-store" } });
  }
}
