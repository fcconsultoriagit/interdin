"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  Building2,
  BriefcaseBusiness,
  ChevronDown,
  CircleHelp,
  Columns3,
  FileText,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Share2,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

const navigation = [
  {
    label: "VISÃO GERAL",
    items: [
      { label: "Visão geral", href: "/painel", icon: LayoutDashboard },
    ],
  },
  {
    label: "TAREFAS",
    items: [
      { label: "Minhas Tarefas", href: "/tarefas/minhas", icon: ListTodo },
      { label: "Todas as Tarefas", href: "/tarefas", icon: ListChecks },
      { label: "Quadro Kanban", href: "/tarefas/kanban", icon: Columns3 },
      { label: "Colaborações", href: "/tarefas/colaboracoes", icon: Share2 },
    ],
  },
  {
    label: "OPERAÇÕES E ANÁLISES",
    items: [
      { label: "Relatórios", href: "/relatorios", icon: FileText },
    ],
  },
  {
    label: "CONFIGURAÇÕES",
    items: [
      { label: "Usuários", href: "/usuarios", icon: Users },
      { label: "Perfis e permissões", href: "/perfis", icon: ShieldCheck },
      { label: "Unidades", href: "/unidades", icon: Building2 },
      { label: "Cargos", href: "/cargos", icon: BriefcaseBusiness },
      { label: "Configurações gerais", href: "/configuracoes", icon: Settings2 },
    ],
  },
];

type AppFrameProps = {
  section: string;
  children: ReactNode;
};

export function AppFrame({ section, children }: AppFrameProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem("interdin-sidebar-collapsed") === "true");
    } catch (error) {
      console.error("Não foi possível carregar a preferência da barra lateral:", error);
    }
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("interdin-sidebar-collapsed", String(next));
      } catch (error) {
        console.error("Não foi possível salvar a preferência da barra lateral:", error);
      }
      return next;
    });
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
          <div className="system-identity" aria-label="InterDin - COATE">
            <span>InterDin</span>
            <span className="system-identity-unit">– COATE</span>
          </div>
        </div>
        <nav className="institutional-quick-links" aria-label="Links institucionais">
          <a href="https://www.tjba.jus.br/portal/">Portal TJBA</a>
          <a href="https://www.tjba.jus.br/portal/transparencia/">Transparência</a>
          <a href="https://www.tjba.jus.br/portal/ouvidoria/">Ouvidoria</a>
          <a href="https://www.tjba.jus.br/portal/acessibilidade/">Acessibilidade</a>
        </nav>
      </header>

      <aside className="sidebar">
        <div className="sidebar-heading">
          <Link className="brand" href="/" aria-label="Interdin início" title="Interdin início">
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
        <div className="workspace-switcher">
          <span className="workspace-avatar">I</span>
          <span className="workspace-copy">
            <strong>Interdin</strong>
            <small>Workspace principal</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <nav className="main-nav" aria-label="Menu principal">
          {navigation.map((group) => (
            <section className="nav-group" key={group.label} aria-label={group.label}>
              <h2 className="nav-group-label">{group.label}</h2>
              <div className="nav-group-items">
                {group.items.map(({ label, href, icon: Icon }) => (
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
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-divider" />
          <button className="account-card" type="button">
            <span className="account-avatar">MC</span>
            <span className="workspace-copy">
              <strong>Mariana Costa</strong>
              <small>Administradora</small>
            </span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Gestão</span>
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
              Suporte institucional <strong>SETIM · Tecnologia da Informação</strong>
            </span>
            <nav aria-label="Links úteis">
              <a href="https://www.tjba.jus.br/portal/">Portal TJBA</a>
              <a href="https://www.tjba.jus.br/portal/transparencia/">Transparência</a>
              <a href="https://www.tjba.jus.br/portal/ouvidoria/">Ouvidoria</a>
            </nav>
            <span className="app-version">InterDin · Versão 1.0.0</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
