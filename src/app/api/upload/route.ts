import { NextResponse } from "next/server";
import { authorizeTaskAttachments, uploadTaskAttachments } from "@/lib/task-attachments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const taskIdFromQuery = new URL(request.url).searchParams.get("taskId");
  if (!taskIdFromQuery) {
    return NextResponse.json({ error: "Informe a tarefa associada aos arquivos." }, { status: 400 });
  }
  const access = await authorizeTaskAttachments(request, taskIdFromQuery, "upload");
  if ("response" in access) return access.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error("Falha ao ler o formulário de upload:", error);
    return NextResponse.json({ error: "Envie os arquivos usando multipart/form-data." }, { status: 400 });
  }
  const taskId = formData.get("taskId");
  if (taskId !== taskIdFromQuery) {
    return NextResponse.json({ error: "A tarefa indicada no formulário não corresponde à solicitação." }, { status: 400 });
  }
  try {
    return await uploadTaskAttachments(formData, taskIdFromQuery, access.user.id, access.prisma);
  } catch (error) {
    console.error("Falha ao enviar anexos:", error);
    return NextResponse.json({ error: "Não foi possível salvar os anexos enviados." }, { status: 500 });
  }
}
