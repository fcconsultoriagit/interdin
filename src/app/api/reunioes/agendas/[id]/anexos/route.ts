import { NextResponse } from "next/server";
import { authorizeMeetingRecord } from "@/lib/meeting-agendas";
import { uploadMeetingAttachments } from "@/lib/meeting-attachments";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await authorizeMeetingRecord(request, id, "edit");
  if ("response" in access) return access.response;
  if (!request.headers.get("content-type")?.toLocaleLowerCase("en-US").startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Envie os arquivos usando multipart/form-data." }, { status: 400 });
  }
  try {
    return await uploadMeetingAttachments(await request.formData(), id, access.prisma);
  } catch (error) {
    console.error("Falha ao enviar anexos da reunião:", error);
    return NextResponse.json({ error: "Não foi possível salvar os anexos." }, { status: 500 });
  }
}
