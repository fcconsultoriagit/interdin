import { NextResponse } from "next/server";
import {
  authorizeTaskAttachments,
  deleteTaskAttachment,
  readTaskAttachment,
} from "@/lib/task-attachments";

type RouteContext = { params: Promise<{ id: string; anexoId: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, { params }: RouteContext) {
  const { id, anexoId } = await params;
  const access = await authorizeTaskAttachments(request, id, "view");
  if ("response" in access) return access.response;

  try {
    const inline = new URL(request.url).searchParams.get("inline") === "true";
    return await readTaskAttachment(access.prisma, id, anexoId, inline);
  } catch (error) {
    console.error("Falha ao abrir anexo da tarefa:", error);
    return NextResponse.json({ error: "Não foi possível abrir o anexo." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id, anexoId } = await params;
  const access = await authorizeTaskAttachments(request, id, "delete");
  if ("response" in access) return access.response;

  try {
    return await deleteTaskAttachment(access.prisma, id, anexoId);
  } catch (error) {
    console.error("Falha ao excluir anexo da tarefa:", error);
    return NextResponse.json({ error: "Não foi possível excluir o anexo da tarefa." }, { status: 500 });
  }
}
