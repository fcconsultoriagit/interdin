import { NextResponse } from "next/server";
import {
  attachmentSelect,
  authorizeTaskAttachments,
  deleteTaskAttachment,
  uploadTaskAttachments,
} from "@/lib/task-attachments";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await authorizeTaskAttachments(request, id, "view");
  if ("response" in access) return access.response;

  try {
    const anexos = await access.prisma.taskAttachment.findMany({
      where: { taskId: id },
      select: attachmentSelect,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ anexos }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Falha ao listar anexos da tarefa:", error);
    return NextResponse.json({ error: "Não foi possível listar os anexos da tarefa." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await authorizeTaskAttachments(request, id, "upload");
  if ("response" in access) return access.response;
  if (!request.headers.get("content-type")?.toLocaleLowerCase("en-US").startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Envie os arquivos usando multipart/form-data." }, { status: 400 });
  }

  try {
    return await uploadTaskAttachments(await request.formData(), id, access.user.id, access.prisma);
  } catch (error) {
    console.error("Falha ao enviar anexos da tarefa:", error);
    return NextResponse.json({ error: "Não foi possível salvar os anexos enviados." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await authorizeTaskAttachments(request, id, "delete");
  if ("response" in access) return access.response;

  try {
    const attachmentId = new URL(request.url).searchParams.get("anexoId");
    if (!attachmentId) {
      return NextResponse.json({ error: "Informe o identificador do anexo." }, { status: 400 });
    }
    return await deleteTaskAttachment(access.prisma, id, attachmentId);
  } catch (error) {
    console.error("Falha ao excluir anexo da tarefa:", error);
    return NextResponse.json({ error: "Não foi possível excluir o anexo da tarefa." }, { status: 500 });
  }
}
