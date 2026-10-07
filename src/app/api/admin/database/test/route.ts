import { NextResponse } from "next/server";
import { authorizeDatabaseAdministration } from "@/lib/admin-database-auth";
import { describeConnectionError, parseConnectionInput, testDatabaseConnection } from "@/lib/admin-database";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authorization = await authorizeDatabaseAdministration(request);
  if ("response" in authorization) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
  }
  const input = parseConnectionInput(body);
  if (!input) {
    return NextResponse.json({ success: false, error: "Informe host, porta, banco, usuário, senha e a opção SSL corretamente." }, { status: 400 });
  }

  try {
    const result = await testDatabaseConnection(input);
    return NextResponse.json({
      success: true,
      message: "Conexão estabelecida com sucesso!",
      version: result.version,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha no teste isolado de conectividade PostgreSQL:", describeConnectionError(error));
    return NextResponse.json({
      success: false,
      error: describeConnectionError(error),
    }, { headers: { "Cache-Control": "no-store" } });
  }
}
