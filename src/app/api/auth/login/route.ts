import { NextResponse } from "next/server";
import { autenticarUsuario, criarTokenSessao, DURACAO_SESSAO_SEGUNDOS, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.email !== "string" || typeof body.senha !== "string") {
      return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const user = await autenticarUsuario(email, body.senha);
    if (!user) {
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }

    const token = criarTokenSessao(user.id);
    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DURACAO_SESSAO_SEGUNDOS,
    });
    return response;
  } catch (error) {
    console.error("Falha ao autenticar usuário:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("AUTH_SECRET")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "O corpo da requisição não contém JSON válido." }, { status: 400 });
    }
    return NextResponse.json({ error: "Não foi possível iniciar a sessão." }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
