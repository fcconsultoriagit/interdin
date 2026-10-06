"use client";

import { Check, Edit3, Plus, Tags, ToggleLeft, ToggleRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";

type Category = {
  id: string;
  sigla: string;
  nome: string;
  cor: string;
  ativa: boolean;
};

const emptyForm = { nome: "", sigla: "", cor: "#0D9488" };

export function CategoryManager() {
  const { hasPermission } = useAuthPermissions();
  const canCreate = hasPermission("categorias", "criar");
  const canEdit = hasPermission("categorias", "editar");
  const canDelete = hasPermission("categorias", "excluir");
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/categorias${canEdit ? "?incluirInativas=true" : ""}`, { cache: "no-store" });
      const payload = await response.json() as { categorias?: Category[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar as categorias.");
      setCategories(payload.categorias ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as categorias.");
    } finally {
      setLoading(false);
    }
  }, [canEdit]);

  useEffect(() => {
    // Initial remote loading updates component state after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const activeCount = useMemo(() => categories.filter(({ ativa }) => ativa).length, [categories]);

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
  }

  function startEdit(category: Category) {
    setEditing(category);
    setForm({ nome: category.nome, sigla: category.sigla, cor: category.cor });
    setError("");
    setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/categorias", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...(editing ? { id: editing.id } : {}) }),
      });
      const payload = await response.json() as { categoria?: Category; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar a categoria.");
      if (!payload.categoria) throw new Error("A resposta da API não contém a categoria salva.");
      const savedCategory = payload.categoria;
      setCategories((current) => {
        const updated = current.filter(({ id }) => id !== savedCategory.id);
        return [...updated, savedCategory].sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"));
      });
      setNotice(`Categoria ${editing ? "atualizada" : "cadastrada"} com sucesso.`);
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a categoria.");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(category: Category, active: boolean) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/categorias", {
        method: active ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(active ? { id: category.id, ativa: true } : { id: category.id }),
      });
      const payload = await response.json() as { categoria?: Category; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível alterar o status da categoria.");
      if (!payload.categoria) throw new Error("A resposta da API não contém a categoria atualizada.");
      const updatedCategory = payload.categoria;
      setCategories((current) => current.map((item) => item.id === updatedCategory.id ? updatedCategory : item));
      setNotice(`Categoria ${active ? "reativada" : "desativada"}.`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Não foi possível alterar o status da categoria.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <div className="eyebrow"><Tags size={15} /> GESTÃO INSTITUCIONAL</div>
          <h1>Categorias</h1>
          <p>Organize as tarefas por categorias identificadas por sigla e cor.</p>
        </div>
      </div>

      {error && <div className="feedback error-feedback" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Fechar"><X size={18} /></button></div>}
      {notice && <div className="feedback success-feedback" role="status"><Check size={17} /> {notice}<button type="button" onClick={() => setNotice("")} aria-label="Fechar"><X size={18} /></button></div>}

      <section className="management-card category-create-card">
        <div className="management-header">
          <div><h2>{editing ? "Editar categoria" : "Inclusão rápida"}</h2><p>Informe nome, sigla e cor para identificar as tarefas.</p></div>
        </div>
        {(canCreate && !editing) || (editing && canEdit) ? (
          <form className="category-form" onSubmit={save}>
            <label className="form-label">Nome
              <input className="form-input" value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} maxLength={120} placeholder="Ex.: Sistemas" required disabled={saving} />
            </label>
            <label className="form-label">Sigla
              <input className="form-input" value={form.sigla} onChange={(event) => setForm((current) => ({ ...current, sigla: event.target.value.toLocaleUpperCase("pt-BR") }))} maxLength={20} placeholder="Ex.: DEV" required disabled={saving} />
            </label>
            <label className="form-label category-color-label">Cor
              <span className="category-color-inputs">
                <input type="color" value={form.cor} onChange={(event) => setForm((current) => ({ ...current, cor: event.target.value.toUpperCase() }))} aria-label="Seletor de cor" disabled={saving} />
                <input className="form-input" value={form.cor} onChange={(event) => setForm((current) => ({ ...current, cor: event.target.value.toUpperCase() }))} pattern="#[0-9A-Fa-f]{6}" aria-label="Código hexadecimal da cor" required disabled={saving} />
              </span>
            </label>
            <div className="category-form-actions">
              <button className="button button-primary" type="submit" disabled={saving}>{editing ? <><Check size={17} /> Salvar</> : <><Plus size={18} /> Adicionar</>}</button>
              {editing && <button className="button button-secondary" type="button" onClick={resetForm} disabled={saving}>Cancelar</button>}
            </div>
          </form>
        ) : <p className="category-read-only">Seu perfil não permite cadastrar ou editar categorias.</p>}
      </section>

      <section className="summary-grid entity-summary" aria-label="Resumo de categorias">
        <article className="summary-card"><span className="summary-icon gold"><Tags size={20} /></span><div><span className="summary-label">Total de categorias</span><strong>{loading ? "—" : categories.length}</strong></div></article>
        <article className="summary-card"><span className="summary-icon blue"><Check size={20} /></span><div><span className="summary-label">Categorias ativas</span><strong>{loading ? "—" : activeCount}</strong></div></article>
      </section>

      <section className="management-card entity-management-card">
        <div className="management-header"><div><h2>Cadastro de categorias</h2><p>Os registros inativos não ficam disponíveis no formulário de tarefas.</p></div></div>
        <div className="entity-table-wrap">
          <table className="entity-table">
            <thead><tr><th>CATEGORIA</th><th>SIGLA</th><th>STATUS</th><th><span className="visually-hidden">Ações</span></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="entity-empty">Carregando categorias...</td></tr> :
                categories.length === 0 ? <tr><td colSpan={4} className="entity-empty">Nenhuma categoria cadastrada.</td></tr> :
                  categories.map((category) => (
                    <tr key={category.id}>
                      <td><span className="category-badge" style={{ color: category.cor, borderColor: category.cor, backgroundColor: `${category.cor}1A` }}>[{category.sigla}] {category.nome}</span></td>
                      <td><span className="entity-acronym">{category.sigla}</span></td>
                      <td><span className={`status-pill${category.ativa ? "" : " inactive"}`}><i />{category.ativa ? "Ativa" : "Inativa"}</span></td>
                      <td><div className="entity-actions">
                        {canEdit && <button className="icon-button" type="button" onClick={() => startEdit(category)} aria-label={`Editar ${category.nome}`} title="Editar"><Edit3 size={18} /></button>}
                        {(category.ativa ? canDelete : canEdit) && <button className={`icon-button status-action${category.ativa ? " is-active" : ""}`} type="button" onClick={() => void setActive(category, !category.ativa)} disabled={saving} aria-label={`${category.ativa ? "Desativar" : "Ativar"} ${category.nome}`} title={category.ativa ? "Desativar" : "Ativar"}>
                          {category.ativa ? <ToggleRight size={21} /> : <ToggleLeft size={21} />}
                        </button>}
                      </div></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="entity-table-footer"><span>{loading ? "Carregando..." : `${categories.length} ${categories.length === 1 ? "categoria" : "categorias"}`}</span><span>As categorias utilizadas em tarefas são desativadas, não removidas.</span></div>
      </section>
    </div>
  );
}
