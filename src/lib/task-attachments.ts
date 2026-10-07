import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { can, type AuthenticatedUser } from "@/lib/rbac";
import { obterSessaoDaRequisicao } from "@/lib/auth";
import { obterPrisma } from "@/lib/prisma";
import { taskVisibilityWhere } from "@/lib/task-api";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 10;
const MAX_LABEL_LENGTH = 180;
const allowedExtensions = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".txt", ".csv", ".odt", ".ods",
]);
const inlineContentTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

type AttachmentAction = "view" | "upload" | "edit";

export type TaskAttachmentAccess = {
  user: AuthenticatedUser;
  prisma: PrismaClient;
} | {
  response: NextResponse;
};

export async function authorizeTaskAttachments(
  request: Request,
  taskId: string,
  action: AttachmentAction,
): Promise<TaskAttachmentAccess> {
  try {
    const user = await obterSessaoDaRequisicao(request);
    if (!user) {
      return {
        response: NextResponse.json({ error: "Autenticação necessária." }, { status: 401 }),
      };
    }

    const canCreate = can(user.permissoes, "tarefas", "criar");
    const canEdit = can(user.permissoes, "tarefas", "editar");
    const hasPermission = action === "view"
      ? can(user.permissoes, "tarefas", "visualizar") || can(user.permissoes, "minhas-tarefas", "visualizar")
      : action === "edit"
        ? canEdit
        : canCreate || canEdit;
    if (!hasPermission) {
      return {
        response: NextResponse.json({ error: "Seu perfil não possui permissão para esta ação." }, { status: 403 }),
      };
    }

    const prisma = obterPrisma();
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        ...taskVisibilityWhere(user.id, user.unidadeId),
      },
      select: { id: true, criadorId: true },
    });
    if (!task) {
      return {
        response: NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 }),
      };
    }
    if (action === "upload" && !canEdit && !(canCreate && task.criadorId === user.id)) {
      return {
        response: NextResponse.json({ error: "Somente quem pode editar pode anexar arquivos a esta tarefa." }, { status: 403 }),
      };
    }
    return { user, prisma };
  } catch (error) {
    console.error("Falha ao autorizar operação de anexo:", error);
    return {
      response: NextResponse.json({ error: "Não foi possível validar o acesso aos anexos." }, { status: 500 }),
    };
  }
}

export async function uploadTaskAttachments(
  formData: FormData,
  taskId: string,
  userId: string,
  prisma: PrismaClient,
) {
  const fileValues = formData.getAll("files");
  const files = fileValues.filter((value): value is File => value instanceof File);
  if (files.length !== fileValues.length || files.length === 0 || files.length > MAX_FILES_PER_UPLOAD) {
    return NextResponse.json(
      { error: `Selecione de 1 a ${MAX_FILES_PER_UPLOAD} arquivos por envio.` },
      { status: 400 },
    );
  }

  const labelsValue = formData.get("names");
  let labels: unknown = [];
  if (typeof labelsValue === "string") {
    try {
      labels = JSON.parse(labelsValue) as unknown;
    } catch {
      return NextResponse.json({ error: "Os nomes descritivos dos arquivos são inválidos." }, { status: 400 });
    }
  }
  if (!Array.isArray(labels) || labels.length !== files.length ||
    !labels.every((label) => typeof label === "string" && label.trim().length > 0 && label.trim().length <= MAX_LABEL_LENGTH)) {
    return NextResponse.json({ error: "Informe um nome descritivo válido para cada arquivo." }, { status: 400 });
  }

  for (const file of files) {
    const extension = extname(file.name).toLocaleLowerCase("en-US");
    if (!allowedExtensions.has(extension)) {
      return NextResponse.json({ error: `O formato do arquivo "${file.name}" não é permitido.` }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `Cada arquivo deve ter até 20 MB e não pode estar vazio.` }, { status: 400 });
    }
  }

  const directory = join(process.cwd(), "storage", "task-attachments");
  const createdIds: string[] = [];
  const writtenPaths: string[] = [];
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    for (const [index, file] of files.entries()) {
      const extension = extname(file.name).toLocaleLowerCase("en-US");
      const id = randomUUID();
      const path = join(process.cwd(), "storage", "task-attachments", `${id}${extension}`);
      await writeFile(path, Buffer.from(await file.arrayBuffer()), { flag: "wx", mode: 0o600 });
      writtenPaths.push(path);
      const attachment = await prisma.taskAttachment.create({
        data: {
          id,
          nome: (labels[index] as string).trim(),
          nomeOriginal: safeOriginalFileName(file.name),
          url: `/api/tarefas/${encodeURIComponent(taskId)}/anexos/${id}`,
          mimeType: file.type || null,
          tamanho: file.size,
          taskId,
          enviadoPorId: userId,
        },
        select: attachmentSelect,
      });
      createdIds.push(attachment.id);
    }
    return NextResponse.json({
      anexos: await prisma.taskAttachment.findMany({
        where: { id: { in: createdIds } },
        select: attachmentSelect,
        orderBy: { createdAt: "desc" },
      }),
    }, { status: 201 });
  } catch (error) {
    await Promise.all(createdIds.map((id) => prisma.taskAttachment.deleteMany({ where: { id } })));
    await Promise.all(writtenPaths.map((path) => unlink(path).catch((cleanupError: NodeJS.ErrnoException) => {
      if (cleanupError.code !== "ENOENT") throw cleanupError;
    })));
    throw error;
  }
}

export const attachmentSelect = {
  id: true,
  nome: true,
  nomeOriginal: true,
  url: true,
  mimeType: true,
  tamanho: true,
  taskId: true,
  enviadoPorId: true,
  createdAt: true,
  enviadoPor: { select: { id: true, nome: true } },
} as const;

export async function deleteTaskAttachment(
  prisma: PrismaClient,
  taskId: string,
  attachmentId: string,
) {
  const attachment = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, taskId },
    select: { id: true, nomeOriginal: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  const extension = extname(attachment.nomeOriginal).toLocaleLowerCase("en-US");
  const path = join(process.cwd(), "storage", "task-attachments", `${attachment.id}${extension}`);
  let fileContents: Buffer | null = null;
  try {
    fileContents = await readFile(path);
  } catch (error) {
    if (!isNodeErrorCode(error, "ENOENT")) throw error;
  }
  if (fileContents) await unlink(path);
  try {
    await prisma.taskAttachment.delete({ where: { id: attachment.id } });
  } catch (error) {
    if (fileContents) await writeFile(path, fileContents, { flag: "wx", mode: 0o600 });
    throw error;
  }
  return NextResponse.json({ sucesso: true });
}

export async function renameTaskAttachment(
  prisma: PrismaClient,
  taskId: string,
  attachmentId: string,
  value: unknown,
) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > MAX_LABEL_LENGTH) {
    return NextResponse.json({ error: "Informe um nome descritivo de até 180 caracteres." }, { status: 400 });
  }
  const attachment = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, taskId },
    select: { id: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }
  const updated = await prisma.taskAttachment.update({
    where: { id: attachment.id },
    data: { nome: value.trim() },
    select: attachmentSelect,
  });
  return NextResponse.json({ anexo: updated });
}

export async function readTaskAttachment(
  prisma: PrismaClient,
  taskId: string,
  attachmentId: string,
  inline: boolean,
) {
  const attachment = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, taskId },
    select: { id: true, nomeOriginal: true, mimeType: true, tamanho: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  const extension = extname(attachment.nomeOriginal).toLocaleLowerCase("en-US");
  const safeInlineType = inlineContentTypes[extension];
  const contentType = inline && safeInlineType ? safeInlineType : "application/octet-stream";
  try {
    const bytes = await readFile(join(process.cwd(), "storage", "task-attachments", `${attachment.id}${extension}`));
    const disposition = inline && safeInlineType ? "inline" : "attachment";
    return new Response(bytes, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.nomeOriginal)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        ...(disposition === "inline" ? { "Content-Security-Policy": "default-src 'none'; sandbox" } : {}),
      },
    });
  } catch (error) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return NextResponse.json({ error: "O arquivo físico deste anexo não está disponível." }, { status: 404 });
    }
    throw error;
  }
}

function isNodeErrorCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

function safeOriginalFileName(fileName: string) {
  const safeName = fileName.replace(/[\\/]+/g, "_").replace(/[\u0000-\u001f\u007f]/g, "_");
  const extension = extname(safeName);
  const baseName = safeName.slice(0, safeName.length - extension.length);
  return `${baseName.slice(0, Math.max(1, 255 - extension.length))}${extension}`;
}
