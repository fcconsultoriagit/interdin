"use client";

import {
  AlertCircle,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  PlugZap,
  Save,
  Server,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AppFrame } from "@/components/app-frame";

type ConnectionForm = {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};
type ActiveConnection = {
  host: string;
  port: number;
  database: string;
  user: string;
  passwordConfigured: boolean;
  ssl: boolean;
};
type DatabaseStatus = {
  healthy: boolean;
  connection: ActiveConnection | null;
  version?: string;
  error?: string;
};
type TestResult = {
  success: boolean;
  message?: string;
  version?: string;
  error?: string;
};

const emptyForm: ConnectionForm = {
  host: "",
  port: "5432",
  database: "",
  user: "",
  password: "",
  ssl: false,
};

export function DatabaseSettingsPage() {
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/admin/database/status", { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const result = await response.json() as DatabaseStatus & { error?: string };
          if (!response.ok) throw new Error(result.error ?? "Não foi possível consultar o status do banco.");
          setStatus(result);
          if (result.connection) {
            setForm((current) => ({
              ...current,
              host: result.connection!.host,
              port: String(result.connection!.port),
              database: result.connection!.database,
              user: result.connection!.user,
              ssl: result.connection!.ssl,
            }));
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setStatusError(error instanceof Error ? error.message : "Não foi possível consultar o status do banco.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setStatusLoading(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  async function testConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/admin/database/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          port: Number(form.port),
        }),
      });
      const result = await response.json() as TestResult;
      if (!response.ok && !result.error) {
        throw new Error("Não foi possível concluir o teste de conexão.");
      }
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : "Não foi possível concluir o teste de conexão.",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <AppFrame section="Banco de Dados" breadcrumbParent="Configurações">
      <div className="page-wrap database-settings-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><Database size={15} /> ADMINISTRAÇÃO DO SISTEMA</div>
            <h1>Banco de Dados</h1>
            <p>Consulte a conexão ativa e teste uma configuração isolada sem alterar o banco em uso.</p>
          </div>
        </div>

        <section className="database-status-card" aria-label="Status da Conexão Ativa">
          <div className="database-status-icon"><Server size={22} /></div>
          <div className="database-status-main">
            <span className="database-card-label">STATUS DA CONEXÃO ATIVA</span>
            <h2>{statusLoading ? "Consultando conexão..." : status?.healthy ? "Sistema conectado" : "Sistema desconectado"}</h2>
            {status?.connection ? (
              <p>
                {status.connection.host}:{status.connection.port} · {status.connection.database} · {status.connection.user}
                {status.connection.ssl ? " · SSL" : ""}
              </p>
            ) : !statusLoading ? <p>{statusError || status?.error || "Não há conexão ativa configurada no servidor."}</p> : null}
            {status?.healthy && status.version && <small className="database-version">{status.version}</small>}
            {!status?.healthy && status?.error && <small className="database-status-error">{status.error}</small>}
          </div>
          <span className={`database-health-badge${statusLoading ? " checking" : status?.healthy ? " healthy" : " unhealthy"}`}>
            <i />{statusLoading ? "Verificando" : status?.healthy ? "Conectado" : "Indisponível"}
          </span>
        </section>
        {statusError && <div className="feedback error-feedback" role="alert"><AlertCircle size={17} />{statusError}</div>}

        <section className="management-card database-test-card">
          <header className="database-test-header">
            <span className="database-test-icon"><PlugZap size={20} /></span>
            <div>
              <h2>Teste de Conexão</h2>
              <p>O teste abre uma conexão temporária e não altera a configuração ativa do sistema.</p>
            </div>
          </header>
          <form onSubmit={(event) => void testConnection(event)}>
            <div className="database-form-grid">
              <label className="database-form-field database-form-wide">
                Servidor / Host
                <input className="form-input" value={form.host} onChange={(event) => setForm({ ...form, host: event.target.value })} placeholder="ex.: postdev01" autoComplete="off" required maxLength={253} />
              </label>
              <label className="database-form-field">
                Porta
                <input className="form-input" type="number" min="1" max="65535" value={form.port} onChange={(event) => setForm({ ...form, port: event.target.value })} required />
              </label>
              <label className="database-form-field">
                Nome do Banco
                <input className="form-input" value={form.database} onChange={(event) => setForm({ ...form, database: event.target.value })} placeholder="ex.: interdin_tjba" autoComplete="off" required maxLength={63} />
              </label>
              <label className="database-form-field">
                Usuário
                <input className="form-input" value={form.user} onChange={(event) => setForm({ ...form, user: event.target.value })} placeholder="ex.: interdin_tjba" autoComplete="username" required maxLength={63} />
              </label>
              <label className="database-form-field database-password-field">
                Senha
                <span className="database-password-control">
                  <input className="form-input" type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" required maxLength={1024} />
                  <button type="button" aria-label={showPassword ? "Ocultar senha" : "Exibir senha"} title={showPassword ? "Ocultar senha" : "Exibir senha"} onClick={() => setShowPassword((visible) => !visible)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              <label className="database-ssl-option">
                <input type="checkbox" checked={form.ssl} onChange={(event) => setForm({ ...form, ssl: event.target.checked })} />
                <span><strong>Exigir SSL</strong><small>Desmarcado por padrão para redes internas.</small></span>
              </label>
            </div>

            {testResult && (
              <div className={`feedback database-test-result ${testResult.success ? "success-feedback" : "error-feedback"}`} role={testResult.success ? "status" : "alert"}>
                {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <div>
                  <strong>{testResult.success ? testResult.message : "Falha na conexão"}</strong>
                  {testResult.success
                    ? <p>{testResult.version}</p>
                    : <p>{testResult.error}</p>}
                </div>
              </div>
            )}

            <div className="database-form-actions">
              <p><LockKeyhole size={15} /> A senha é usada apenas neste teste e nunca é persistida ou retornada pela API.</p>
              <div>
                <button className="button button-primary" type="submit" disabled={testing}>
                  {testing ? <LoaderCircle className="spin" size={17} /> : <PlugZap size={17} />}
                  {testing ? "Testando conectividade..." : "Testar Conectividade"}
                </button>
                <button className="button button-secondary database-save-disabled" type="button" disabled title="Salvar e aplicar será habilitado após a validação operacional do teste.">
                  <Save size={16} /> Salvar e Aplicar
                </button>
              </div>
            </div>
          </form>
        </section>

        <div className="database-security-note"><ShieldCheck size={17} /><span>Esta tela e suas APIs são restritas a Administradores totais. O teste usa uma conexão isolada e não modifica a conexão Prisma ativa.</span></div>
      </div>
    </AppFrame>
  );
}
