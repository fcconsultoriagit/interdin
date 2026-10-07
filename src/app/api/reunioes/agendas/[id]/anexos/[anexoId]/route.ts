import { NextResponse } from "next/server";
import { authorizeMeetingRecord } from "@/lib/meeting-agendas";
import { deleteMeetingAttachment, readMeetingAttachment } from "@/lib/meeting-attachments";

type RouteContext = { params: Promise<{ id: string; anexoId: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, { params }: RouteContext) {
  const { id, anexoId } = await params;
  const access = await authorizeMeetingRecord(request, id, "view");
  if ("response" in access) return access.response;
  try {
    return await readMeetingAttachment(
      access.prisma,
      id,
      anexoId,
      new URL(request.url).searchParams.get("inline") === "true",
    );
  } catch (error) {
    console.error("Falha ao abrir anexo de reunião:", error);
    return NextResponse.json({ error: "Não foi possível abrir o anexo." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id, anexoId } = await params;
  const access = await authorizeMeetingRecord(request, id, "edit");
  if ("response" in access) return access.response;
  try {
    return await deleteMeetingAttachment(access.prisma, id, anexoId);
  } catch (error) {
    console.error("Falha ao excluir anexo de reunião:", error);
    return NextResponse.json({ error: "Não foi possível excluir o anexo." }, { status: 500 });
  }
}
