import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";

const maxFileSize = 20 * 1024 * 1024;
const allowedTypes = new Map([
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".xls", "application/vnd.ms-excel"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".ppt", "application/vnd.ms-powerpoint"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".odt", "application/vnd.oasis.opendocument.text"],
  [".ods", "application/vnd.oasis.opendocument.spreadsheet"],
  [".txt", "text/plain"],
  [".csv", "text/csv"],
]);
const inlineTypes = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"]);
const attachmentDirectory = join(process.cwd(), "storage", "meeting-attachments");

export async function uploadMeetingAttachments(formData: FormData, agendaId: string, prisma: PrismaClient) {
  const fileValues = formData.getAll("files");
  const files = fileValues.filter((value): value is File => value instanceof File);
  const namesValue = formData.get("names");
  let names: unknown;
  try {
    names = typeof namesValue === "string" ? JSON.parse(namesValue) as unknown : null;
  } catch {
    return NextResponse.json({ error: "Os nomes dos anexos estão inválidos." }, { status: 400 });
  }
  if (files.length < 1 || files.length > 10 || files.length !== fileValues.length ||
    !Array.isArray(names) || names.length !== files.length ||
    !names.every((name) => typeof name === "string" && name.trim().length > 0 && name.trim().length <= 180)) {
    return NextResponse.json({ error: "Selecione de 1 a 10 arquivos e informe um nome válido para cada um." }, { status: 400 });
  }
  const storageNames: string[] = [];
  for (const file of files) {
    const extension = extname(file.name).toLocaleLowerCase("en-US");
    if (!allowedTypes.has(extension)) {
      return NextResponse.json({ error: `O formato de "${file.name}" não é permitido.` }, { status: 400 });
    }
    if (file.size < 1 || file.size > maxFileSize) {
      return NextResponse.json({ error: "Cada arquivo deve ter até 20 MB e não pode estar vazio." }, { status: 400 });
    }
    storageNames.push(`${randomUUID()}${extension}`);
  }

  const createdIds: string[] = [];
  const writtenPaths: string[] = [];
  try {
    await mkdir(attachmentDirectory, { recursive: true, mode: 0o700 });
    for (const [index, file] of files.entries()) {
      const storageName = storageNames[index];
      const path = join(attachmentDirectory, storageName);
      await writeFile(path, Buffer.from(await file.arrayBuffer()), { flag: "wx", mode: 0o600 });
      writtenPaths.push(path);
      const attachment = await prisma.meetingAttachment.create({
        data: {
          agendaId,
          nome: (names[index] as string).trim(),
          url: storageName,
          tamanho: file.size,
          mimeType: allowedTypes.get(extname(file.name).toLocaleLowerCase("en-US")) ?? null,
        },
        select: { id: true, nome: true, url: true, tamanho: true, mimeType: true, createdAt: true },
      });
      createdIds.push(attachment.id);
    }
    return NextResponse.json({
      anexos: await prisma.meetingAttachment.findMany({
        where: { id: { in: createdIds } },
        select: { id: true, nome: true, url: true, tamanho: true, mimeType: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    }, { status: 201 });
  } catch (error) {
    await Promise.all(createdIds.map((id) => prisma.meetingAttachment.deleteMany({ where: { id } })));
    await Promise.all(writtenPaths.map((path) => unlink(path).catch((cleanupError: NodeJS.ErrnoException) => {
      if (cleanupError.code !== "ENOENT") throw cleanupError;
    })));
    throw error;
  }
}

export async function readMeetingAttachment(prisma: PrismaClient, agendaId: string, attachmentId: string, inline: boolean) {
  const attachment = await prisma.meetingAttachment.findFirst({
    where: { id: attachmentId, agendaId },
    select: { nome: true, url: true, mimeType: true, tamanho: true },
  });
  if (!attachment || !/^[0-9a-f-]{36}\.[a-z0-9]{1,10}$/i.test(attachment.url)) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }
  const mimeType = attachment.mimeType && inlineTypes.has(attachment.mimeType) ? attachment.mimeType : "application/octet-stream";
  try {
    const bytes = await readFile(join(attachmentDirectory, attachment.url));
    const disposition = inline && mimeType !== "application/octet-stream" ? "inline" : "attachment";
    return new Response(bytes, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.nome)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        ...(disposition === "inline" ? { "Content-Security-Policy": "default-src 'none'; sandbox" } : {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "O arquivo físico não está disponível." }, { status: 404 });
    }
    throw error;
  }
}

export async function deleteMeetingAttachment(prisma: PrismaClient, agendaId: string, attachmentId: string) {
  const attachment = await prisma.meetingAttachment.findFirst({
    where: { id: attachmentId, agendaId },
    select: { id: true, url: true },
  });
  if (!attachment || !/^[0-9a-f-]{36}\.[a-z0-9]{1,10}$/i.test(attachment.url)) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }
  const path = join(attachmentDirectory, attachment.url);
  let bytes: Buffer | null = null;
  try {
    bytes = await readFile(path);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  if (bytes) await unlink(path);
  try {
    await prisma.meetingAttachment.delete({ where: { id: attachment.id } });
  } catch (error) {
    if (bytes) await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
    throw error;
  }
  return NextResponse.json({ sucesso: true });
}

export async function deleteMeetingAttachmentsForAgenda(prisma: PrismaClient, agendaId: string) {
  const attachments = await prisma.meetingAttachment.findMany({
    where: { agendaId },
    select: { id: true, url: true },
  });
  const savedFiles: Array<{ path: string; bytes: Buffer }> = [];
  try {
    for (const attachment of attachments) {
      if (!/^[0-9a-f-]{36}\.[a-z0-9]{1,10}$/i.test(attachment.url)) {
        throw new Error("O armazenamento de um anexo da reunião contém um caminho inválido.");
      }
      const path = join(attachmentDirectory, attachment.url);
      try {
        const bytes = await readFile(path);
        await unlink(path);
        savedFiles.push({ path, bytes });
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      }
    }
    await prisma.meetingAgenda.delete({ where: { id: agendaId } });
  } catch (error) {
    await Promise.all(savedFiles.map(({ path, bytes }) => writeFile(path, bytes, { flag: "wx", mode: 0o600 })));
    throw error;
  }
}
