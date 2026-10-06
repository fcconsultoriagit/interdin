"use client";

import {
  Check,
  Edit3,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";

type Permission = {
  verMenu: boolean;
  visualizar: boolean;
  criar: boolean;
  editar: boolean;
  excluir: boolean;
};
type Unidade = { id: string; nome: string; sigla: string; ativo: boolean };
type Cargo = { id: string; nome: string; ativo: boolean };
type Perfil = {
  id: string;
  nome: string;
  ativo: boolean;
  permissoes: Permission[];
};
type Usuario = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  podeAtribuirParaOutros: boolean;
  podeConvidarColaboradores: boolean;
  unidadeId: string | null;
  cargoId: string | null;
  perfilId: string | null;
  unidade: Unidade | null;
  cargo: Cargo | null;
  perfil: Perfil | null;
};
type UserForm = {
  nome: string;
  email: string;
  senha: string;
  unidadeId: string;
  cargoId: string;
  perfilId: string;
  podeAtribuirParaOutros: boolean;
  podeConvidarColaboradores: boolean;
};

const emptyForm: UserForm = {
  nome: "",
  email: "",
  senha: "",
  unidadeId: "",
  cargoId: "",
  perfilId: "",
  podeAtribuirParaOutros: false,
  podeConvidarColaboradores: false,
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR"))
    .join("");
}

function permissionCount(profile: Perfil | null) {
  return profile?.permissoes.reduce(
    (total, permission) =>
      total +
      Number(permission.verMenu) +
      Number(permission.visualizar) +
      Number(permission.criar) +
      Number(permission.editar) +
      Number(permission.excluir),
    0,
  ) ?? 0;
}

export default function UsuariosPage() {
  const { hasPermission, user: currentUser } = useAuthPermissions();
  const canCreate = hasPermission("usuarios", "criar");
  const canEdit = hasPermission("usuarios", "editar");
  const canManageTaskGovernance = currentUser?.permissoes.administradorTotal === true;
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [profileFilter, setProfileFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  const loadData = useCallback(async () => {
    try {
      const [usersResponse, unitsResponse, jobsResponse, profilesResponse] = await Promise.all([
        fetch("/api/usuarios"),
        hasPermission("unidades", "visualizar") ? fetch("/api/unidades") : null,
        hasPermission("cargos", "visualizar") ? fetch("/api/cargos") : null,
        hasPermission("perfis", "visualizar") ? fetch("/api/perfis") : null,
      ]);
      const [usersPayload, unitsPayload, jobsPayload, profilesPayload] = await Promise.all([
        usersResponse.json(),
        unitsResponse?.json() ?? Promise.resolve({ unidades: [] }),
        jobsResponse?.json() ?? Promise.resolve({ cargos: [] }),
        profilesResponse?.json() ?? Promise.resolve({ perfis: [] }),
      ]) as [
        { usuarios?: Usuario[]; error?: string },
        { unidades?: Unidade[]; error?: string },
        { cargos?: Cargo[]; error?: string },
        { perfis?: Perfil[]; error?: string },
      ];
      const failedPayload = !usersResponse.ok
        ? usersPayload
        : unitsResponse && !unitsResponse.ok
          ? unitsPayload
          : jobsResponse && !jobsResponse.ok
            ? jobsPayload
            : profilesResponse && !profilesResponse.ok
              ? profilesPayload
              : null;
      if (failedPayload) throw new Error(failedPayload.error ?? "Não foi possível carregar os cadastros.");
      setUsuarios(usersPayload.usuarios ?? []);
      setUnidades(unitsPayload.unidades ?? []);
      setCargos(jobsPayload.cargos ?? []);
      setPerfis(profilesPayload.perfis ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os cadastros.");
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    // Initial remote loading updates component state after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return usuarios.filter((user) => {
      const matchesSearch =
        !query ||
        user.nome.toLocaleLowerCase("pt-BR").includes(query) ||
        user.email.toLocaleLowerCase("pt-BR").includes(query);
      return (
        matchesSearch &&
        (!unitFilter || user.unidadeId === unitFilter) &&
        (!jobFilter || user.cargoId === jobFilter) &&
        (!profileFilter || user.perfilId === profileFilter) &&
        (!statusFilter || user.ativo === (statusFilter === "ativo"))
      );
    });
  }, [usuarios, search, unitFilter, jobFilter, profileFilter, statusFilter]);

  const activeUsers = usuarios.filter((user) => user.ativo).length;
  const usersWithoutProfile = usuarios.filter((user) => !user.perfilId).length;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(user: Usuario) {
    setEditing(user);
    setForm({
      nome: user.nome,
      email: user.email,
      senha: "",
      unidadeId: user.unidadeId ?? "",
      cargoId: user.cargoId ?? "",
      perfilId: user.perfilId ?? "",
      podeAtribuirParaOutros: user.podeAtribuirParaOutros,
      podeConvidarColaboradores: user.podeConvidarColaboradores,
    });
    setError("");
    setModalOpen(true);
  }

  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = {
        nome: form.nome,
        email: form.email,
        senha: form.senha,
        unidadeId: form.unidadeId || null,
        cargoId: form.cargoId || null,
        perfilId: form.perfilId || null,
        podeAtribuirParaOutros: form.podeAtribuirParaOutros,
        podeConvidarColaboradores: form.podeConvidarColaboradores,
      };
      const response = await fetch(
        editing ? `/api/usuarios/${editing.id}` : "/api/usuarios",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json()) as { usuario?: Usuario; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar o usuário.");
      const savedUser = payload.usuario;
      if (!savedUser) throw new Error("A resposta da API não contém o usuário salvo.");
      setUsuarios((current) =>
        editing
          ? current.map((user) => user.id === savedUser.id ? savedUser : user)
          : [...current, savedUser].sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR")),
      );
      setModalOpen(false);
      setNotice(`Usuário ${editing ? "atualizado" : "cadastrado"} com sucesso.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o usuário.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user: Usuario) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/usuarios/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !user.ativo }),
      });
      const payload = (await response.json()) as { usuario?: Usuario; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível alterar o status.");
      const updatedUser = payload.usuario;
      if (!updatedUser) throw new Error("A resposta da API não contém o usuário atualizado.");
      setUsuarios((current) => current.map((item) => item.id === user.id ? { ...item, ativo: updatedUser.ativo } : item));
      setNotice(`Usuário ${updatedUser.ativo ? "ativado" : "desativado"}.`);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Não foi possível alterar o status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppFrame section="Usuários">
      <div className="page-wrap">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><KeyRound size={15} /> CONTROLE DE ACESSO</div>
            <h1>Usuários</h1>
            <p>Gerencie os acessos institucionais, vínculos e perfis dos usuários do sistema.</p>
          </div>
          {canCreate && (
            <button className="button button-primary" onClick={openCreate} type="button">
              <Plus size={18} /> Novo usuário
            </button>
          )}
        </div>

        {error && (
          <div className="feedback error-feedback" role="alert">
            {error}
            <button type="button" onClick={() => setError("")} aria-label="Fechar"><X size={18} /></button>
          </div>
        )}
        {notice && (
          <div className="feedback success-feedback" role="status">
            <Check size={17} /> {notice}
            <button type="button" onClick={() => setNotice("")} aria-label="Fechar"><X size={18} /></button>
          </div>
        )}

        <section className="summary-grid" aria-label="Resumo dos usuários">
          <article className="summary-card">
            <span className="summary-icon gold"><Users size={20} /></span>
            <div><span className="summary-label">Total de usuários</span><strong>{loading ? "—" : usuarios.length}</strong></div>
          </article>
          <article className="summary-card">
            <span className="summary-icon green"><Check size={20} /></span>
            <div><span className="summary-label">Usuários ativos</span><strong>{loading ? "—" : activeUsers}</strong></div>
          </article>
          <article className="summary-card">
            <span className="summary-icon blue"><ShieldCheck size={20} /></span>
            <div><span className="summary-label">Sem perfil vinculado</span><strong>{loading ? "—" : usersWithoutProfile}</strong></div>
          </article>
        </section>

        <section className="management-card users-management-card">
          <div className="users-toolbar">
            <label className="search-field users-search">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                aria-label="Buscar usuários por nome ou e-mail"
              />
              <kbd>⌘ K</kbd>
            </label>
            <label className="filter-select-label">
              <span>Unidade</span>
              <select aria-label="Filtrar por unidade" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}>
                <option value="">Todas</option>
                {unidades.map((unit) => <option key={unit.id} value={unit.id}>{unit.sigla} · {unit.nome}</option>)}
              </select>
            </label>
            <label className="filter-select-label">
              <span>Cargo</span>
              <select aria-label="Filtrar por cargo" value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}>
                <option value="">Todos</option>
                {cargos.map((job) => <option key={job.id} value={job.id}>{job.nome}</option>)}
              </select>
            </label>
            <label className="filter-select-label">
              <span>Perfil</span>
              <select aria-label="Filtrar por perfil" value={profileFilter} onChange={(event) => setProfileFilter(event.target.value)}>
                <option value="">Todos</option>
                {perfis.map((profile) => <option key={profile.id} value={profile.id}>{profile.nome}</option>)}
              </select>
            </label>
            <label className="filter-select-label status-filter">
              <span>Status</span>
              <select aria-label="Filtrar por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Todos</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
              </select>
            </label>
          </div>

          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>USUÁRIO</th>
                  <th>LOTAÇÃO</th>
                  <th>CARGO</th>
                  <th>PERFIL DE ACESSO</th>
                  <th>STATUS</th>
                  <th><span className="visually-hidden">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="users-empty">Carregando usuários...</td></tr>
                ) : visibleUsers.length === 0 ? (
                  <tr><td colSpan={6} className="users-empty">
                    {usuarios.length === 0 ? "Nenhum usuário cadastrado." : "Nenhum usuário corresponde aos filtros."}
                  </td></tr>
                ) : visibleUsers.map((user, index) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <span className={`user-avatar avatar-${index % 4}`}>{initials(user.nome)}</span>
                        <span className="user-cell-copy"><strong>{user.nome}</strong><span>{user.email}</span></span>
                      </div>
                    </td>
                    <td>{user.unidade ? <span className="entity-acronym">{user.unidade.sigla}</span> : <span className="table-muted">—</span>}</td>
                    <td>{user.cargo?.nome ?? <span className="table-muted">Não informado</span>}</td>
                    <td>
                      {user.perfil ? (
                        <span className="user-profile-badge" title={`${permissionCount(user.perfil)} permissões configuradas`}>
                          <ShieldCheck size={15} />
                          <span>{user.perfil.nome}</span>
                          <small>{permissionCount(user.perfil)}</small>
                        </span>
                      ) : <span className="table-muted">Sem perfil</span>}
                    </td>
                    <td><span className={`status-pill${user.ativo ? "" : " inactive"}`}><i />{user.ativo ? "Ativo" : "Inativo"}</span></td>
                    <td>
                      <div className="entity-actions">
                        {canEdit && <button className="icon-button" type="button" onClick={() => openEdit(user)} aria-label={`Editar ${user.nome}`} title="Editar cadastro">
                          <Edit3 size={18} />
                        </button>}
                        {canEdit && <button
                          className={`icon-button status-action${user.ativo ? " is-active" : ""}`}
                          type="button"
                          onClick={() => void toggleStatus(user)}
                          disabled={saving}
                          aria-label={`${user.ativo ? "Desativar" : "Ativar"} ${user.nome}`}
                          title={user.ativo ? "Desativar usuário" : "Ativar usuário"}
                        >
                          {user.ativo ? <ToggleRight size={21} /> : <ToggleLeft size={21} />}
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="entity-table-footer">
            <span>{loading ? "Carregando..." : `${visibleUsers.length} de ${usuarios.length} usuários`}</span>
            <span>As senhas são armazenadas com hash seguro.</span>
          </div>
        </section>

        {modalOpen && (
          <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setModalOpen(false);
          }}>
            <form className="create-modal user-modal" onSubmit={saveUser} aria-labelledby="user-modal-title">
              <div className="modal-heading">
                <span className="modal-icon"><Users size={20} /></span>
                <button className="icon-button" type="button" onClick={() => setModalOpen(false)} aria-label="Fechar" disabled={saving}><X size={19} /></button>
              </div>
              <h2 id="user-modal-title">{editing ? "Editar usuário" : "Novo usuário"}</h2>
              <p>{editing ? "Atualize os dados cadastrais e vínculos de acesso." : "Cadastre um usuário e configure seus vínculos institucionais."}</p>

              <div className="user-form-grid">
                <label className="user-form-field user-form-field-wide">
                  <span>Nome completo</span>
                  <input className="form-input" value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Nome e sobrenome" maxLength={160} required autoFocus />
                </label>
                <label className="user-form-field user-form-field-wide">
                  <span>E-mail institucional</span>
                  <input className="form-input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="nome@tjba.jus.br" maxLength={254} required />
                </label>
                <label className="user-form-field">
                  <span>Unidade</span>
                  <select className="form-input" value={form.unidadeId} onChange={(event) => setForm({ ...form, unidadeId: event.target.value })}>
                    <option value="">Sem unidade</option>
                    {unidades.filter((unit) => unit.ativo || unit.id === editing?.unidadeId).map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.sigla} · {unit.nome}{unit.ativo ? "" : " (inativa)"}</option>
                    ))}
                  </select>
                </label>
                <label className="user-form-field">
                  <span>Cargo</span>
                  <select className="form-input" value={form.cargoId} onChange={(event) => setForm({ ...form, cargoId: event.target.value })}>
                    <option value="">Sem cargo</option>
                    {cargos.filter((job) => job.ativo || job.id === editing?.cargoId).map((job) => (
                      <option key={job.id} value={job.id}>{job.nome}{job.ativo ? "" : " (inativo)"}</option>
                    ))}
                  </select>
                </label>
                <label className="user-form-field user-form-field-wide">
                  <span>Perfil de acesso</span>
                  <select className="form-input" value={form.perfilId} onChange={(event) => setForm({ ...form, perfilId: event.target.value })}>
                    <option value="">Sem perfil</option>
                    {perfis.filter((profile) => profile.ativo || profile.id === editing?.perfilId).map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.nome}{profile.ativo ? "" : " (inativo)"}</option>
                    ))}
                  </select>
                </label>
                <fieldset className="task-choice-fieldset user-form-field-wide">
                  <legend>Governança de tarefas</legend>
                  <label className="task-choice user-governance-option">
                    <input
                      type="checkbox"
                      checked={form.podeAtribuirParaOutros}
                      onChange={(event) => setForm({ ...form, podeAtribuirParaOutros: event.target.checked })}
                      disabled={saving || !canManageTaskGovernance}
                    />
                    <span>Permitir atribuir tarefas a outros usuários</span>
                  </label>
                  <label className="task-choice user-governance-option">
                    <input
                      type="checkbox"
                      checked={form.podeConvidarColaboradores}
                      onChange={(event) => setForm({ ...form, podeConvidarColaboradores: event.target.checked })}
                      disabled={saving || !canManageTaskGovernance}
                    />
                    <span>Permitir convidar colaboradores para tarefas</span>
                  </label>
                  {!canManageTaskGovernance && <small>Somente um administrador total pode alterar estas permissões.</small>}
                </fieldset>
                <label className="user-form-field user-form-field-wide">
                  <span>Senha {editing && <small>(deixe em branco para manter a senha atual)</small>}</span>
                  <input
                    className="form-input"
                    type="password"
                    value={form.senha}
                    onChange={(event) => setForm({ ...form, senha: event.target.value })}
                    placeholder={editing ? "Senha atual será mantida" : "Mínimo de 8 caracteres"}
                    minLength={editing ? undefined : 8}
                    autoComplete={editing ? "new-password" : "new-password"}
                    required={!editing}
                  />
                </label>
              </div>
              {error && <p className="modal-error" role="alert">{error}</p>}
              <div className="modal-actions">
                <button className="button button-secondary" type="button" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
                <button className="button button-primary" type="submit" disabled={saving}>
                  {saving ? "Salvando..." : <><Check size={17} /> Salvar usuário</>}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppFrame>
  );
}
