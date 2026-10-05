"use client";

import {
  Activity,
  ArrowDownUp,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

const actions = [
  { key: "verMenu", label: "Ver menu" },
  { key: "visualizar", label: "Visualizar" },
  { key: "criar", label: "Criar" },
  { key: "editar", label: "Editar" },
  { key: "excluir", label: "Excluir" },
] as const;

type PermissionAction = (typeof actions)[number]["key"];
type Permission = {
  recursoId: string;
} & Record<PermissionAction, boolean>;
type Resource = { id: string; nome: string; slug: string };
type Module = { id: string; nome: string; recursos: Resource[] };
type Profile = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  permissoes: Permission[];
  _count: { usuarios: number };
};

const menuItems = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "Usuários", icon: Users },
  { label: "Perfis e permissões", icon: ShieldCheck, active: true },
  { label: "Atividades", icon: Activity },
  { label: "Relatórios", icon: FileText },
];

export default function Home() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/perfis");
      const payload = (await response.json()) as {
        perfis?: Profile[];
        modulos?: Module[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar os dados.");

      setProfiles(payload.perfis ?? []);
      setModules(payload.modulos ?? []);
      setSelectedId((current) =>
        payload.perfis?.some((profile) => profile.id === current)
          ? current
          : (payload.perfis?.[0]?.id ?? ""),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Não foi possível carregar os dados.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const selected = profiles.find((profile) => profile.id === selectedId);
  const visibleProfiles = useMemo(
    () =>
      profiles.filter((profile) =>
        profile.nome.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")),
      ),
    [profiles, search],
  );

  const permissionFor = (resourceId: string) =>
    selected?.permissoes.find((permission) => permission.recursoId === resourceId);

  async function savePermissions() {
    if (!selected) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/perfis/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissoes: selected.permissoes,
        }),
      });
      const payload = (await response.json()) as Profile & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar as alterações.");
      setProfiles((current) => current.map((profile) => (profile.id === payload.id ? payload : profile)));
      setNotice("Permissões atualizadas com sucesso.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  function togglePermission(resourceId: string, action: PermissionAction) {
    if (!selected) return;
    const current = permissionFor(resourceId);
    const next: Permission = {
      recursoId: resourceId,
      verMenu: current?.verMenu ?? false,
      visualizar: current?.visualizar ?? false,
      criar: current?.criar ?? false,
      editar: current?.editar ?? false,
      excluir: current?.excluir ?? false,
      [action]: !(current?.[action] ?? false),
    };
    setProfiles((items) =>
      items.map((profile) =>
        profile.id === selected.id
          ? {
              ...profile,
              permissoes: [
                ...profile.permissoes.filter((permission) => permission.recursoId !== resourceId),
                next,
              ],
            }
          : profile,
      ),
    );
    setNotice("");
  }

  async function createProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/perfis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: draftName,
          descricao: draftDescription,
          permissoes: modules.flatMap((module) =>
            module.recursos.map((resource) => ({
              recursoId: resource.id,
              verMenu: false,
              visualizar: false,
              criar: false,
              editar: false,
              excluir: false,
            })),
          ),
        }),
      });
      const payload = (await response.json()) as Profile & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível criar o perfil.");

      setProfiles((current) => [...current, payload].sort((a, b) => a.nome.localeCompare(b.nome)));
      setSelectedId(payload.id);
      setDraftName("");
      setDraftDescription("");
      setShowCreate(false);
      setNotice("Perfil criado. Agora você pode configurar as permissões.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile() {
    if (!selected || !window.confirm(`Excluir o perfil "${selected.nome}"?`)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/perfis/${selected.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Não foi possível excluir o perfil.");
      }
      const remaining = profiles.filter((profile) => profile.id !== selected.id);
      setProfiles(remaining);
      setSelectedId(remaining[0]?.id ?? "");
      setNotice("Perfil excluído.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir.");
    } finally {
      setSaving(false);
    }
  }

  const assignedUsers = profiles.reduce((sum, profile) => sum + profile._count.usuarios, 0);
  const enabledPermissions = selected?.permissoes.reduce(
    (sum, permission) => sum + actions.filter(({ key }) => permission[key]).length,
    0,
  ) ?? 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Interdin início">
          <span className="brand-mark"><Sparkles size={19} strokeWidth={2.4} /></span>
          <span>interdin<span className="brand-dot">.</span></span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">I</span>
          <span className="workspace-copy"><strong>Interdin</strong><small>Workspace principal</small></span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">MENU PRINCIPAL</div>
        <nav className="main-nav" aria-label="Menu principal">
          {menuItems.map(({ label, icon: Icon, active }) => (
            <a key={label} className={`nav-item${active ? " active" : ""}`} href="#" aria-current={active ? "page" : undefined}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Atividades" && <span className="nav-count">4</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a className="nav-item" href="#"><Settings2 size={18} strokeWidth={1.8} /><span>Configurações</span></a>
          <div className="sidebar-divider" />
          <button className="account-card" type="button">
            <span className="account-avatar">MC</span>
            <span className="workspace-copy"><strong>Mariana Costa</strong><small>Administradora</small></span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Configurações</span><span className="crumb-separator">/</span><strong>Perfis e permissões</strong></div>
          <div className="topbar-actions">
            <button className="icon-button help-button" aria-label="Ajuda" type="button"><CircleHelp size={18} /></button>
            <button className="icon-button notification-button" aria-label="Notificações" type="button"><Bell size={18} /><i /></button>
            <span className="topbar-avatar">MC</span>
          </div>
        </header>

        <div className="page-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><LockKeyhole size={13} /> CONTROLE DE ACESSO</div>
              <h1>Perfis e permissões</h1>
              <p>Gerencie os níveis de acesso e o que cada perfil pode fazer na plataforma.</p>
            </div>
            <button className="button button-primary" onClick={() => setShowCreate(true)} type="button">
              <Plus size={17} /> Novo perfil
            </button>
          </div>

          <section className="summary-grid" aria-label="Resumo">
            <article className="summary-card">
              <span className="summary-icon purple"><Shield size={18} /></span>
              <div><span className="summary-label">Perfis cadastrados</span><strong>{loading ? "—" : profiles.length.toString().padStart(2, "0")}</strong></div>
              <span className="summary-note">{profiles.filter((profile) => profile.ativo).length} ativos</span>
            </article>
            <article className="summary-card">
              <span className="summary-icon blue"><Users size={18} /></span>
              <div><span className="summary-label">Usuários vinculados</span><strong>{loading ? "—" : assignedUsers.toString().padStart(2, "0")}</strong></div>
              <span className="summary-note">em todos os perfis</span>
            </article>
            <article className="summary-card">
              <span className="summary-icon green"><ShieldCheck size={18} /></span>
              <div><span className="summary-label">Permissões configuradas</span><strong>{loading ? "—" : enabledPermissions.toString().padStart(2, "0")}</strong></div>
              <span className="summary-note">no perfil selecionado</span>
            </article>
          </section>

          {error && <div className="feedback error-feedback" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Fechar"><X size={16} /></button></div>}
          {notice && <div className="feedback success-feedback" role="status"><Check size={16} />{notice}<button type="button" onClick={() => setNotice("")} aria-label="Fechar"><X size={16} /></button></div>}

          <section className="management-card">
            <div className="management-header">
              <div>
                <h2>Perfis de acesso</h2>
                <p>Selecione um perfil para visualizar e editar suas permissões.</p>
              </div>
              <div className="management-tools">
                <label className="search-field">
                  <Search size={16} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar perfil..." aria-label="Buscar perfil" />
                  <kbd>⌘ K</kbd>
                </label>
                <button className="icon-button filter-button" type="button" aria-label="Ordenar perfis"><ArrowDownUp size={16} /></button>
              </div>
            </div>

            <div className="workspace-grid">
              <div className="profile-list">
                <div className="list-caption">TODOS OS PERFIS <span>{profiles.length}</span></div>
                {loading ? (
                  <div className="list-placeholder">Carregando perfis...</div>
                ) : visibleProfiles.length === 0 ? (
                  <div className="list-placeholder">{search ? "Nenhum perfil encontrado." : "Nenhum perfil cadastrado."}</div>
                ) : visibleProfiles.map((profile, index) => (
                  <button key={profile.id} className={`profile-item${selectedId === profile.id ? " selected" : ""}`} onClick={() => setSelectedId(profile.id)} type="button">
                    <span className={`profile-avatar avatar-${index % 4}`}>{profile.nome.slice(0, 1).toLocaleUpperCase("pt-BR")}</span>
                    <span className="profile-item-copy"><strong>{profile.nome}</strong><small>{profile._count.usuarios} {profile._count.usuarios === 1 ? "usuário" : "usuários"}</small></span>
                    {selectedId === profile.id && <span className="selected-indicator" />}
                  </button>
                ))}
                <button className="add-profile-link" type="button" onClick={() => setShowCreate(true)}><Plus size={15} /> Adicionar perfil</button>
              </div>

              <div className="permissions-panel">
                {selected ? (
                  <>
                    <div className="selected-profile-header">
                      <div className="selected-profile-info">
                        <span className="profile-avatar avatar-large">{selected.nome.slice(0, 1).toLocaleUpperCase("pt-BR")}</span>
                        <div><div className="profile-title-line"><h3>{selected.nome}</h3><span className={`status-pill${selected.ativo ? "" : " inactive"}`}><i />{selected.ativo ? "Ativo" : "Inativo"}</span></div><p>{selected.descricao || "Sem descrição cadastrada."}</p></div>
                      </div>
                      <button className="icon-button delete-button" type="button" onClick={deleteProfile} disabled={saving} aria-label="Excluir perfil"><Trash2 size={17} /></button>
                    </div>

                    <div className="permissions-title-row">
                      <div><h3>Matriz de permissões</h3><p>Defina o acesso permitido para cada recurso.</p></div>
                      <button className="text-button" type="button" onClick={() => setNotice("Marque as ações na matriz e salve as alterações.")}><SlidersHorizontal size={15} /> Como funciona</button>
                    </div>

                    <div className="permission-table-wrap">
                      <table className="permission-table">
                        <thead><tr><th>RECURSO</th>{actions.map(({ key, label }) => <th key={key}>{label}</th>)}</tr></thead>
                        <tbody>
                          {modules.map((module) => (
                            <Fragment key={module.id}>
                              <tr className="module-row"><td colSpan={6}><span className="module-marker" />{module.nome}</td></tr>
                              {module.recursos.map((resource) => (
                                <tr className="resource-row" key={resource.id}>
                                  <td>{resource.nome}</td>
                                  {actions.map(({ key }) => (
                                    <td key={key}>
                                      <button
                                        className={`permission-check${permissionFor(resource.id)?.[key] ? " checked" : ""}`}
                                        type="button"
                                        role="checkbox"
                                        aria-checked={permissionFor(resource.id)?.[key] ?? false}
                                        aria-label={`${resource.nome}: ${actions.find((action) => action.key === key)?.label}`}
                                        onClick={() => togglePermission(resource.id, key)}
                                      >{permissionFor(resource.id)?.[key] && <Check size={13} strokeWidth={2.8} />}</button>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="permissions-footer">
                      <span><LockKeyhole size={14} /> As alterações afetam todos os usuários deste perfil.</span>
                      <button className="button button-primary save-button" onClick={savePermissions} type="button" disabled={saving}>
                        {saving ? "Salvando..." : <><Check size={16} /> Salvar alterações</>}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-icon"><Shield size={23} /></span>
                    <h3>{loading ? "Carregando perfis..." : "Comece criando um perfil"}</h3>
                    <p>Perfis agrupam permissões para facilitar o gerenciamento de acesso das equipes.</p>
                    {!loading && <button className="button button-primary" onClick={() => setShowCreate(true)} type="button"><Plus size={16} /> Criar primeiro perfil</button>}
                  </div>
                )}
              </div>
            </div>
          </section>
          <footer className="page-footer"><span>© 2025 Interdin. Todos os direitos reservados.</span><span>Central de ajuda <span className="footer-dot">·</span> Privacidade</span></footer>
        </div>
      </main>

      {showCreate && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowCreate(false);
        }}>
          <form className="create-modal" onSubmit={createProfile} aria-labelledby="create-profile-title">
            <div className="modal-heading">
              <span className="modal-icon"><Shield size={19} /></span>
              <button className="icon-button" type="button" onClick={() => setShowCreate(false)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <h2 id="create-profile-title">Novo perfil</h2>
            <p>Crie um perfil para organizar o acesso dos usuários.</p>
            <label className="form-label" htmlFor="profile-name">Nome do perfil</label>
            <input id="profile-name" className="form-input" value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Ex.: Gestor de operações" maxLength={80} required autoFocus />
            <label className="form-label" htmlFor="profile-description">Descrição <span>(opcional)</span></label>
            <textarea id="profile-description" className="form-input form-textarea" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} placeholder="Descreva brevemente este perfil..." maxLength={240} rows={3} />
            <div className="modal-actions">
              <button className="button button-secondary" type="button" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="button button-primary" type="submit" disabled={saving}>{saving ? "Criando..." : <><Plus size={16} /> Criar perfil</>}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
