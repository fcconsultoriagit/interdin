import { Client, type ClientConfig } from "pg";

export type DatabaseConnectionInput = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

export type DatabaseConnectionSummary = Omit<DatabaseConnectionInput, "password"> & {
  passwordConfigured: boolean;
};

export function parseConnectionInput(value: unknown): DatabaseConnectionInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const host = typeof input.host === "string" ? input.host.trim() : "";
  const database = typeof input.database === "string" ? input.database.trim() : "";
  const user = typeof input.user === "string" ? input.user.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (
    !host || host.length > 253 || /[\s/\\?#@]/.test(host) ||
    !database || database.length > 63 || /[\u0000-\u001f]/.test(database) ||
    !user || user.length > 63 || /[\u0000-\u001f]/.test(user) ||
    !password || password.length > 1024 ||
    !Number.isInteger(input.port) || (input.port as number) < 1 || (input.port as number) > 65535 ||
    typeof input.ssl !== "boolean"
  ) {
    return null;
  }
  return {
    host,
    port: input.port as number,
    database,
    user,
    password,
    ssl: input.ssl,
  };
}

export function getActiveConnectionSummary(): DatabaseConnectionSummary | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  try {
    const url = new URL(connectionString);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return null;
    const sslMode = url.searchParams.get("sslmode");
    return {
      host: url.hostname,
      port: Number(url.port) || 5432,
      database: decodeURIComponent(url.pathname.slice(1)),
      user: decodeURIComponent(url.username),
      passwordConfigured: Boolean(url.password),
      ssl: Boolean(sslMode && !["disable", "allow", "prefer"].includes(sslMode)),
    };
  } catch {
    console.error("A URL ativa do banco de dados não pôde ser interpretada.");
    return null;
  }
}

export async function testDatabaseConnection(input: DatabaseConnectionInput) {
  const config: ClientConfig = {
    host: input.host,
    port: input.port,
    database: input.database,
    user: input.user,
    password: input.password,
    ssl: input.ssl ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: 6000,
    query_timeout: 6000,
    statement_timeout: 6000,
    application_name: "InterDin database connectivity test",
  };
  const client = new Client(config);
  let connected = false;
  try {
    await client.connect();
    connected = true;
    const result = await client.query<{ version: string }>("SELECT version()");
    return { success: true as const, version: result.rows[0]?.version ?? "Versão não informada." };
  } finally {
    if (connected) await client.end().catch((error: unknown) => {
      console.error("Falha ao encerrar a conexão temporária de teste com o banco:", error);
    });
  }
}

export function describeConnectionError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "";
  if (code === "P1000" || code === "28P01" || code === "28000") return "Autenticação recusada. Verifique usuário e senha.";
  if (code === "P1001" || code === "ECONNREFUSED" || code === "EHOSTUNREACH" || code === "ENETUNREACH") {
    return "Não foi possível alcançar o servidor. Verifique host, porta, rede e firewall.";
  }
  if (code === "P1002" || code === "ETIMEDOUT" || code === "CONNECT_TIMEOUT") {
    return "Tempo limite excedido. Verifique conectividade, firewall e VPN.";
  }
  if (code === "P1003" || code === "3D000") return "Banco de dados não encontrado. Verifique o nome informado.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "Host não encontrado. Verifique o endereço DNS e a rede.";
  if (code === "CERT_HAS_EXPIRED" || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || code === "SELF_SIGNED_CERT_IN_CHAIN") {
    return "Não foi possível validar o certificado SSL do PostgreSQL.";
  }
  if (error instanceof Error && /timeout/i.test(error.message)) return "Tempo limite excedido. Verifique conectividade, firewall e VPN.";
  if (error instanceof Error && error.message) return error.message.slice(0, 500);
  return "Não foi possível estabelecer a conexão com o PostgreSQL.";
}
