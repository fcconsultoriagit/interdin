"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Database,
  Building2,
  BriefcaseBusiness,
  ChevronDown,
  CircleHelp,
  Columns3,
  FileText,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  CalendarDays,
  ClipboardList,
  Scale,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";

const navigation = [
  {
    label: "VISÃO GERAL",
    items: [
    { label: "Visão geral", href: "/painel", resource: "painel", icon: LayoutDashboard },
    ],
  },
  {
    label: "TAREFAS",
    items: [
      { label: "Minhas Tarefas", href: "/tarefas/minhas", resource: "minhas-tarefas", icon: ListTodo },
      { label: "Todas as Tarefas", href: "/tarefas", resource: "tarefas", icon: ListChecks },
      { label: "Quadro Kanban", href: "/tarefas/kanban", resource: "kanban", icon: Columns3 },
    ],
  },
  {
    label: "REUNIÕES & SÚMULAS",
    items: [
      { label: "Agendas", href: "/reunioes/agendas", resource: "reunioes", icon: CalendarDays },
      { label: "Súmulas", href: "/reunioes/sumulas", resource: "sumulas", icon: ClipboardList },
      { label: "Decisões", href: "/reunioes/decisoes", resource: "decisoes", icon: Scale },
    ],
  },
  {
    label: "OPERAÇÕES E ANÁLISES",
    divider: true,
    items: [
      { label: "Relatórios", href: "/relatorios", resource: "relatorios", icon: FileText },
    ],
  },
  {
    label: "CONFIGURAÇÕES",
    divider: true,
    items: [
      { label: "Usuários", href: "/usuarios", resource: "usuarios", icon: Users },
      { label: "Perfis e permissões", href: "/perfis", resource: "perfis", icon: ShieldCheck },
      { label: "Unidades", href: "/unidades", resource: "unidades", icon: Building2 },
      { label: "Cargos", href: "/cargos", resource: "cargos", icon: BriefcaseBusiness },
      { label: "Categorias", href: "/categorias", resource: "categorias", icon: Tags },
      { label: "Banco de Dados", href: "/configuracoes/banco-de-dados", resource: "configuracoes", icon: Database, adminOnly: true },
      { label: "Configurações gerais", href: "/configuracoes", resource: "configuracoes", icon: Settings2 },
    ],
  },
];

const navigationScopes = [
  { value: "all", label: "Visão Completa" },
  { value: "VISÃO GERAL", label: "Visão Geral" },
  { value: "TAREFAS", label: "Tarefas" },
  { value: "REUNIÕES & SÚMULAS", label: "Reuniões & Súmulas" },
  { value: "OPERAÇÕES E ANÁLISES", label: "Operações e Análises" },
  { value: "CONFIGURAÇÕES", label: "Configurações" },
] as const;

type NavigationScope = (typeof navigationScopes)[number]["value"];

const sidebarPreferenceKey = "interdin-sidebar-collapsed";

function subscribeToSidebarPreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("interdin-sidebar-toggle", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("interdin-sidebar-toggle", callback);
  };
}

function getSidebarPreference() {
  try {
    return window.localStorage.getItem(sidebarPreferenceKey) === "true";
  } catch (error) {
    console.error("Não foi possível carregar a preferência da barra lateral:", error);
    return false;
  }
}

function getServerSidebarPreference() {
  return false;
}

type AppFrameProps = {
  section: string;
  breadcrumbParent?: string;
  children: ReactNode;
};

export function AppFrame({ section, breadcrumbParent = "Gestão", children }: AppFrameProps) {
  const router = useRouter();
  const { user, canViewMenu } = useAuthPermissions();
  const sidebarCollapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarPreference,
    getServerSidebarPreference,
  );
  const [logoutError, setLogoutError] = useState("");
  const [assignedTaskCount, setAssignedTaskCount] = useState<number | null>(null);
  const [navigationScope, setNavigationScope] = useState<NavigationScope>("all");

  const refreshAssignedTaskCount = useCallback(async () => {
    if (!user || !canViewMenu("minhas-tarefas")) return;
    try {
      const response = await fetch("/api/tarefas/minhas-count", { cache: "no-store" });
      const payload = await response.json() as { total?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar a contagem de tarefas.");
      if (typeof payload.total !== "number") throw new Error("A contagem de tarefas retornada é inválida.");
      setAssignedTaskCount(payload.total);
    } catch (error) {
      console.error("Falha ao carregar o badge de tarefas atribuídas:", error);
    }
  }, [canViewMenu, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshAssignedTaskCount(), 0);
    window.addEventListener("interdin-task-count-refresh", refreshAssignedTaskCount);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("interdin-task-count-refresh", refreshAssignedTaskCount);
    };
  }, [refreshAssignedTaskCount]);

  function toggleSidebar() {
    try {
      window.localStorage.setItem(sidebarPreferenceKey, String(!sidebarCollapsed));
    } catch (error) {
      console.error("Não foi possível salvar a preferência da barra lateral:", error);
    }
    window.dispatchEvent(new Event("interdin-sidebar-toggle"));
  }

  async function logout() {
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Não foi possível encerrar a sessão.");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Falha ao encerrar sessão:", error);
      setLogoutError(error instanceof Error ? error.message : "Não foi possível encerrar a sessão.");
    }
  }

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <header className="institutional-header">
        <div className="institutional-identification">
          <a className="court-identity" href="https://www.tjba.jus.br/portal/">
            <Image
              className="court-crest"
              src="/logo-tjba.png"
              alt=""
              width={300}
              height={223}
              priority
            />
            <span>
              Tribunal de Justiça <strong>do Estado da Bahia</strong>
            </span>
          </a>
          <span className="identity-divider" aria-hidden="true" />
          <div className="system-identity" aria-label="InterDin | COATE">
            <span>InterDin</span>
            <span className="system-identity-unit">COATE</span>
          </div>
        </div>
        <nav className="institutional-quick-links" aria-label="Links institucionais">
          <a href="https://www.tjba.jus.br/portal/">Portal TJBA</a>
          <a href="https://www.tjba.jus.br/portal/transparencia/">Transparência</a>
          <a href="https://www.tjba.jus.br/portal/ouvidoria/">Ouvidoria</a>
          <a href="https://www.tjba.jus.br/portal/acessibilidade/">Acessibilidade</a>
        </nav>
      </header>

      <div className="workspace-shell">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <Link className="brand" href="/painel" aria-label="Interdin início" title="Interdin início">
              <span className="brand-mark">
                <Sparkles size={19} strokeWidth={2.4} />
              </span>
              <span>
                interdin<span className="brand-dot">.</span>
              </span>
            </Link>
            <button
              className="sidebar-toggle"
              type="button"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
          <label className="workspace-switcher">
            <span className="workspace-avatar">I</span>
            <span className="workspace-copy">
              <strong>Interdin</strong>
              <small>{navigationScopes.find(({ value }) => value === navigationScope)?.label}</small>
            </span>
            <ChevronDown size={15} />
            <select
              className="workspace-scope-control"
              aria-label="Escopo da navegação"
              value={navigationScope}
              onChange={(event) => {
                const selectedScope = navigationScopes.find(({ value }) => value === event.target.value);
                if (selectedScope) setNavigationScope(selectedScope.value);
              }}
            >
              {navigationScopes.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <nav className="main-nav" aria-label="Menu principal">
            {navigation.filter((group) => (
              (navigationScope === "all" || group.label === navigationScope)
              && group.items.some(({ resource, adminOnly }) => canViewMenu(resource) && (!adminOnly || user?.permissoes.administradorTotal))
            )).map((group) => (
              <section className={`nav-group${"divider" in group && group.divider ? " nav-group-divider" : ""}`} key={group.label} aria-label={group.label}>
                <h2 className="nav-group-label">{group.label}</h2>
                <div className="nav-group-items">
                  {group.items.filter(({ resource, adminOnly }) => canViewMenu(resource) && (!adminOnly || user?.permissoes.administradorTotal)).map(({ label, href, icon: Icon }) => (
                    <Link
                      key={href}
                      className={`nav-item${section === label ? " active" : ""}`}
                      href={href}
                      aria-label={label}
                      aria-current={section === label ? "page" : undefined}
                      title={label}
                      data-tooltip={label}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                      <span>{label}</span>
                      {href === "/tarefas/minhas" && assignedTaskCount !== null && (
                        <span className="nav-count" aria-label={`${assignedTaskCount} tarefas atribuídas`}>
                          {assignedTaskCount}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </nav>
          <div className="sidebar-bottom">
            {logoutError && <div className="sidebar-error" role="alert">{logoutError}</div>}
            <div className="sidebar-divider" />
            <button className="account-card" type="button" onClick={() => void logout()} title="Encerrar sessão">
              <span className="account-avatar">{user?.nome.split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR")).join("") ?? "?"}</span>
              <span className="workspace-copy">
                <strong>{user?.nome ?? "Usuário"}</strong>
                <small>{user?.perfilNome ?? "Sem perfil"}</small>
              </span>
              <MoreHorizontal size={18} />
            </button>
          </div>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div className="breadcrumbs">
              <span>{breadcrumbParent}</span>
              <span className="crumb-separator">/</span>
              <strong>{section}</strong>
            </div>
            <div className="topbar-actions">
              <button className="icon-button help-button" aria-label="Ajuda" type="button">
                <CircleHelp size={18} />
              </button>
              <button className="icon-button notification-button" aria-label="Notificações" type="button">
                <Bell size={18} />
                <i />
              </button>
              <span className="topbar-avatar">MC</span>
            </div>
          </header>

          {children}

          <footer className="institutional-footer">
            <div className="footer-brand-signature" aria-label="Marcas TJBA, SETIM e InterDin">
              <span className="footer-tjba">TJBA</span>
              <span className="signature-divider" aria-hidden="true" />
              <span className="footer-setim">SETIM</span>
              <span className="signature-divider" aria-hidden="true" />
              <span className="footer-interdin">InterDin</span>
            </div>
            <div className="footer-institutional-details">
              <span>
                Interação Dinâmica <strong>SETIM · Tecnologia da Informação</strong>
              </span>
              <span className="app-version">InterDin · Versão 1.0.0</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
