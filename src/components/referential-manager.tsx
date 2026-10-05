"use client";

import {
  Building2,
  BriefcaseBusiness,
  Check,
  Edit3,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";

type ReferentialKind = "unidades" | "cargos";
type Referential = {
  id: string;
  nome: string;
  sigla?: string;
  ativo: boolean;
  _count: { usuarios: number };
};

type ReferentialManagerProps = { kind: ReferentialKind };

const definitions = {
  unidades: {
    singular: "Unidade",
    plural: "Unidades",
    description: "Cadastre e gerencie as unidades organizacionais do Tribunal.",
    icon: Building2,
  },
  cargos: {
    singular: "Cargo",
    plural: "Cargos",
    description: "Cadastre e gerencie os cargos vinculados aos usuários.",
    icon: BriefcaseBusiness,
  },
} as const;

export function ReferentialManager({ kind }: ReferentialManagerProps) {
  const { hasPermission } = useAuthPermissions();
  const canCreate = hasPermission(kind, "criar");
  const canEdit = hasPermission(kind, "editar");
  const definition = definitions[kind];
  const Icon = definition.icon;
  const [items, setItems] = useState<Referential[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Referential | null>(null);
  const [name, setName] = useState("");
  const [sigla, setSigla] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/${kind}`);
      const payload = (await response.json()) as {
        unidades?: Referential[];
        cargos?: Referential[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? `Não foi possível carregar ${definition.plural.toLocaleLowerCase("pt-BR")}.`);
      setItems(kind === "unidades" ? payload.unidades ?? [] : payload.cargos ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
    }
  }, [definition.plural, kind]);

  useEffect(() => {
    // Initial remote loading updates component state after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) =>
      `${item.nome} ${item.sigla ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalized),
    );
  }, [items, search]);

  const activeCount = items.filter((item) => item.ativo).length;
  const linkedUsers = items.reduce((total, item) => total + item._count.usuarios, 0);

  function openCreateModal() {
    setEditing(null);
    setName("");
    setSigla("");
    setError("");
    setModalOpen(true);
  }

  function openEditModal(item: Referential) {
    setEditing(item);
    setName(item.nome);
    setSigla(item.sigla ?? "");
    setError("");
    setModalOpen(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        editing ? `/api/${kind}/${editing.id}` : `/api/${kind}`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kind === "unidades" ? { nome: name, sigla } : { nome: name }),
        },
      );
      const payload = (await response.json()) as {
        unidade?: Referential;
        cargo?: Referential;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? `Não foi possível salvar ${definition.singular.toLocaleLowerCase("pt-BR")}.`);

      const saved = kind === "unidades" ? payload.unidade : payload.cargo;
      if (!saved) throw new Error("A resposta da API não contém o registro salvo.");
      setItems((current) =>
        editing
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved].sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR")),
      );
      setModalOpen(false);
      setNotice(`${definition.singular} ${editing ? "atualizada" : "cadastrada"} com sucesso.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Não foi possível salvar ${definition.singular.toLocaleLowerCase("pt-BR")}.`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: Referential) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/${kind}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !item.ativo }),
      });
      const payload = (await response.json()) as {
        unidade?: Referential;
        cargo?: Referential;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível alterar o status.");
      const updated = kind === "unidades" ? payload.unidade : payload.cargo;
      if (!updated) throw new Error("A resposta da API não contém o registro atualizado.");
      setItems((current) => current.map((currentItem) => currentItem.id === updated.id ? updated : currentItem));
      setNotice(`${definition.singular} ${updated.ativo ? "ativada" : "inativada"}.`);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Não foi possível alterar o status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <div className="eyebrow"><Icon size={15} /> GESTÃO INSTITUCIONAL</div>
          <h1>{definition.plural}</h1>
          <p>{definition.description}</p>
        </div>
        {canCreate && (
          <button className="button button-primary" onClick={openCreateModal} type="button">
            <Plus size={18} /> Nova {definition.singular}
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

      <section className="summary-grid entity-summary" aria-label={`Resumo de ${definition.plural.toLocaleLowerCase("pt-BR")}`}>
        <article className="summary-card">
          <span className="summary-icon gold"><Icon size={20} /></span>
          <div><span className="summary-label">Total de {definition.plural.toLocaleLowerCase("pt-BR")}</span><strong>{loading ? "—" : items.length}</strong></div>
        </article>
        <article className="summary-card">
          <span className="summary-icon blue"><Check size={20} /></span>
          <div><span className="summary-label">Registros ativos</span><strong>{loading ? "—" : activeCount}</strong></div>
        </article>
        <article className="summary-card">
          <span className="summary-icon green"><Users size={20} /></span>
          <div><span className="summary-label">Usuários vinculados</span><strong>{loading ? "—" : linkedUsers}</strong></div>
        </article>
      </section>

      <section className="management-card entity-management-card">
        <div className="management-header">
          <div>
            <h2>Cadastro de {definition.plural.toLocaleLowerCase("pt-BR")}</h2>
            <p>Consulte, edite e altere o status dos registros cadastrados.</p>
          </div>
          <label className="search-field">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Buscar ${definition.plural.toLocaleLowerCase("pt-BR")}...`}
              aria-label={`Buscar ${definition.plural.toLocaleLowerCase("pt-BR")}`}
            />
          </label>
        </div>
        <div className="entity-table-wrap">
          <table className="entity-table">
            <thead>
              <tr>
                <th>{kind === "unidades" ? "UNIDADE" : "CARGO"}</th>
                {kind === "unidades" && <th>SIGLA</th>}
                {kind === "unidades" && <th>USUÁRIOS VINCULADOS</th>}
                <th>STATUS</th>
                <th><span className="visually-hidden">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={kind === "unidades" ? 5 : 3} className="entity-empty">Carregando registros...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={kind === "unidades" ? 5 : 3} className="entity-empty">
                  {search ? "Nenhum registro corresponde à busca." : `Nenhum(a) ${definition.singular.toLocaleLowerCase("pt-BR")} cadastrado(a).`}
                </td></tr>
              ) : filteredItems.map((item) => (
                <tr key={item.id}>
                  <td><span className="entity-name"><span className="entity-row-icon"><Icon size={18} /></span>{item.nome}</span></td>
                  {kind === "unidades" && <td><span className="entity-acronym">{item.sigla}</span></td>}
                  {kind === "unidades" && <td>{item._count.usuarios}</td>}
                  <td><span className={`status-pill${item.ativo ? "" : " inactive"}`}><i />{item.ativo ? "Ativo" : "Inativo"}</span></td>
                  <td>
                    <div className="entity-actions">
                      {canEdit && <button className="icon-button" type="button" onClick={() => openEditModal(item)} aria-label={`Editar ${item.nome}`} title="Editar">
                        <Edit3 size={18} />
                      </button>}
                      {canEdit && <button
                        className={`icon-button status-action${item.ativo ? " is-active" : ""}`}
                        type="button"
                        onClick={() => void toggleActive(item)}
                        disabled={saving}
                        aria-label={`${item.ativo ? "Inativar" : "Ativar"} ${item.nome}`}
                        title={item.ativo ? "Inativar" : "Ativar"}
                      >
                        {item.ativo ? <ToggleRight size={21} /> : <ToggleLeft size={21} />}
                      </button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="entity-table-footer">
          <span>{loading ? "Carregando..." : `${filteredItems.length} ${filteredItems.length === 1 ? "registro" : "registros"}`}</span>
          <span>Os vínculos com usuários são preservados ao inativar.</span>
        </div>
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setModalOpen(false);
        }}>
          <form className="create-modal" onSubmit={save} aria-labelledby="referential-modal-title">
            <div className="modal-heading">
              <span className="modal-icon"><Icon size={20} /></span>
              <button className="icon-button" type="button" onClick={() => setModalOpen(false)} aria-label="Fechar" disabled={saving}><X size={19} /></button>
            </div>
            <h2 id="referential-modal-title">{editing ? `Editar ${definition.singular.toLocaleLowerCase("pt-BR")}` : `Nova ${definition.singular.toLocaleLowerCase("pt-BR")}`}</h2>
            <p>{editing ? "Atualize os dados do cadastro." : `Informe os dados para cadastrar ${definition.singular === "Unidade" ? "uma nova unidade" : "um novo cargo"}.`}</p>
            <label className="form-label" htmlFor={`${kind}-name`}>Nome</label>
            <input
              id={`${kind}-name`}
              className="form-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={kind === "unidades" ? "Ex.: Secretaria de Tecnologia" : "Ex.: Analista Judiciário"}
              maxLength={120}
              required
              autoFocus
            />
            {kind === "unidades" && (
              <>
                <label className="form-label" htmlFor="unidades-sigla">Sigla</label>
                <input
                  id="unidades-sigla"
                  className="form-input"
                  value={sigla}
                  onChange={(event) => setSigla(event.target.value.toLocaleUpperCase("pt-BR"))}
                  placeholder="Ex.: SETIM"
                  maxLength={20}
                  required
                />
              </>
            )}
            {error && <p className="modal-error" role="alert">{error}</p>}
            <div className="modal-actions">
              <button className="button button-secondary" type="button" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
              <button className="button button-primary" type="submit" disabled={saving}>
                {saving ? "Salvando..." : <><Check size={17} /> {editing ? "Salvar alterações" : "Cadastrar"}</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
