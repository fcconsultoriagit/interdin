"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilePlus2,
  Filter,
  ListChecks,
  LoaderCircle,
  Pencil,
  Plus,
  Printer,
  Search,
  Columns3,
  ShieldAlert,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { AppFrame } from "@/components/app-frame";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";

const statusOptions = [
  { value: "NAO_INICIADO", label: "Não Iniciado" },
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "PENDENTE_COORDENACAO", label: "Pendente Coordenação" },
  { value: "CONCLUIDO", label: "Concluído" },
  { value: "ARQUIVADA", label: "Arquivada" },
] as const;
const kanbanStatuses = statusOptions.filter(({ value }) => value !== "ARQUIVADA");
const priorityOptions = [
  { value: "BAIXA", label: "Baixa" },
  { value: "MEDIA", label: "Média" },
  { value: "ALTA", label: "Alta" },
  { value: "URGENTE", label: "Urgente" },
] as const;

type TaskStatus = (typeof statusOptions)[number]["value"];
type TaskPriority = (typeof priorityOptions)[number]["value"];
type UserOption = { id: string; nome: string };
type UnitOption = { id: string; nome: string; sigla: string };
type CategoryOption = { id: string; sigla: string; nome: string; cor: string };
type Task = {
  id: string;
  numero: number;
  codigo: string | null;
  titulo: string;
  descricao: string | null;
  notasImportantes: string | null;
  privada: boolean;
  status: TaskStatus;
  prioridade: TaskPriority;
  categoria: string | null;
  categoriaId: string | null;
  category: CategoryOption | null;
  progresso: number;
  prazo: string | null;
  dataTarefa: string;
  responsavelId: string | null;
  criadorId: string;
  unidadeId: string | null;
  unidadesCompartilhadas: string[];
  colaboradoresIds: string[];
  createdAt: string;
  responsavel: UserOption | null;
  criador: UserOption;
  unidade: UnitOption | null;
};
type TaskForm = {
  titulo: string;
  dataTarefa: string;
  privada: boolean;
  unidadeId: string;
  unidadesCompartilhadas: string[];
  descricao: string;
  responsavelId: string;
  prazo: string;
  status: TaskStatus;
  categoriaId: string;
  prioridade: TaskPriority;
  progresso: number;
  notasImportantes: string;
  colaboradoresIds: string[];
};
type TaskOptions = {
  usuarios: UserOption[];
  unidades: UnitOption[];
  categorias: CategoryOption[];
};
type TaskResponse = {
  tarefas: Task[];
  pagina: number;
  porPagina: number;
  total: number;
  paginas: number;
  contagens: Record<TaskStatus, number>;
  opcoes: TaskOptions;
  error?: string;
};

const initialOptions: TaskOptions = { usuarios: [], unidades: [], categorias: [] };
const emptyCounts = Object.fromEntries(statusOptions.map(({ value }) => [value, 0])) as Record<TaskStatus, number>;
const subscribeToClientReady = () => () => {};
const getClientReady = () => true;
const getServerClientReady = () => false;
const emptyForm: TaskForm = {
  titulo: "",
  dataTarefa: dateTimeLocalValue(new Date()),
  privada: false,
  unidadeId: "",
  unidadesCompartilhadas: [],
  descricao: "",
  responsavelId: "",
  prazo: "",
  status: "NAO_INICIADO",
  categoriaId: "",
  prioridade: "MEDIA",
  progresso: 0,
  notasImportantes: "",
  colaboradoresIds: [],
};

function dateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function getStatusLabel(status: TaskStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function getPriorityLabel(priority: TaskPriority) {
  return priorityOptions.find((option) => option.value === priority)?.label ?? priority;
}

function categoryBadgeStyle(category: CategoryOption | null): CSSProperties | undefined {
  if (!category) return undefined;
  return {
    color: category.cor,
    borderColor: category.cor,
    backgroundColor: `${category.cor}1A`,
  };
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR")).join("");
}

function isOverdue(task: Task) {
  return task.prazo !== null &&
    new Date(task.prazo).getTime() < Date.now() &&
    task.status !== "CONCLUIDO" &&
    task.status !== "ARQUIVADA";
}

export function TaskListPage({ view = "list" }: { view?: "list" | "kanban" }) {
  const { hasPermission, user } = useAuthPermissions();
  const canCreate = hasPermission("tarefas", "criar");
  const canEdit = hasPermission("tarefas", "editar");
  const canView = hasPermission("tarefas", "visualizar");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState(emptyCounts);
  const [options, setOptions] = useState(initialOptions);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [movingTaskIds, setMovingTaskIds] = useState<Set<string>>(() => new Set());
  const portalReady = useSyncExternalStore(
    subscribeToClientReady,
    getClientReady,
    getServerClientReady,
  );

  const query = useMemo(() => {
    const params = new URLSearchParams({ pagina: String(page), porPagina: view === "kanban" ? "100" : "12" });
    if (search.trim()) params.set("busca", search.trim());
    if (view === "list") {
      if (statusFilter) params.set("status", statusFilter);
      if (categoryFilter) params.set("categoria", categoryFilter);
      if (responsibleFilter) params.set("responsavelId", responsibleFilter);
      if (unitFilter) params.set("unidadeId", unitFilter);
      if (dateFrom) params.set("dataDe", dateFrom);
      if (dateTo) params.set("dataAte", dateTo);
    } else {
      params.set("ocultarArquivadas", "true");
    }
    return params.toString();
  }, [page, search, statusFilter, categoryFilter, responsibleFilter, unitFilter, dateFrom, dateTo, view]);

  const loadTasks = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/tarefas?${query}`, { signal, cache: "no-store" });
      const payload = await response.json() as TaskResponse;
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar as tarefas.");
      setTasks(payload.tarefas);
      setCounts(payload.contagens);
      setOptions(payload.opcoes);
      setPages(payload.paginas);
      setTotal(payload.total);
    } catch (loadError) {
      if (signal.aborted) return;
      console.error("Falha ao carregar tarefas:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as tarefas.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadTasks(controller.signal), 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadTasks]);

  function openCreate() {
    setEditingTask(null);
    setViewingTask(null);
    setForm({
      ...emptyForm,
      dataTarefa: dateTimeLocalValue(new Date()),
      unidadeId: user?.unidadeId ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  function openTask(task: Task, readOnly: boolean) {
    const taskCategory = task.category;
    setEditingTask(readOnly ? null : task);
    setViewingTask(readOnly ? task : null);
    setForm({
      titulo: task.titulo,
      dataTarefa: dateTimeLocalValue(new Date(task.dataTarefa)),
      privada: task.privada,
      unidadeId: task.unidadeId ?? "",
      unidadesCompartilhadas: task.unidadesCompartilhadas,
      descricao: task.descricao ?? "",
      responsavelId: task.responsavelId ?? "",
      prazo: task.prazo ? dateTimeLocalValue(new Date(task.prazo)) : "",
      status: task.status,
      categoriaId: task.categoriaId ?? "",
      prioridade: task.prioridade,
      progresso: task.progresso,
      notasImportantes: task.notasImportantes ?? "",
      colaboradoresIds: task.colaboradoresIds,
    });
    if (taskCategory) {
      setOptions((current) => current.categorias.some(({ id }) => id === taskCategory.id)
        ? current
        : { ...current, categorias: [...current.categorias, taskCategory] });
    }
    setError("");
    setModalOpen(true);
  }

  function updateForm<K extends keyof TaskForm>(key: K, value: TaskForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleSelection(key: "unidadesCompartilhadas" | "colaboradoresIds", id: string) {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(id)
        ? current[key].filter((selected) => selected !== id)
        : [...current[key], id],
    }));
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        categoriaId: form.categoriaId || null,
        responsavelId: form.responsavelId || null,
        unidadeId: form.unidadeId || null,
        prazo: form.prazo ? new Date(form.prazo).toISOString() : null,
        dataTarefa: new Date(form.dataTarefa).toISOString(),
      };
      const response = await fetch(editingTask ? `/api/tarefas/${editingTask.id}` : "/api/tarefas", {
        method: editingTask ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar a tarefa.");
      setModalOpen(false);
      setNotice(editingTask ? "Tarefa atualizada com sucesso." : "Tarefa criada com sucesso.");
      const controller = new AbortController();
      await loadTasks(controller.signal);
    } catch (saveError) {
      console.error("Falha ao salvar tarefa:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a tarefa.");
    } finally {
      setSaving(false);
    }
  }

  function setStatus(status: string) {
    setPage(1);
    setStatusFilter((current) => current === status ? "" : status);
  }

  async function moveTask(task: Task, nextStatus: TaskStatus) {
    if (!canEdit || task.status === nextStatus || movingTaskIds.has(task.id)) return;
    const previousStatus = task.status;
    setError("");
    setMovingTaskIds((current) => new Set(current).add(task.id));
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item));
    setCounts((current) => ({
      ...current,
      [previousStatus]: Math.max(0, current[previousStatus] - 1),
      [nextStatus]: current[nextStatus] + 1,
    }));
    try {
      const response = await fetch(`/api/tarefas/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json() as { tarefa?: Task; error?: string };
      if (!response.ok || !result.tarefa) {
        throw new Error(result.error ?? "Não foi possível mover a tarefa.");
      }
      setTasks((current) => current.map((item) => item.id === task.id ? result.tarefa! : item));
    } catch (moveError) {
      console.error("Falha ao mover tarefa no quadro:", moveError);
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: previousStatus } : item));
      setCounts((current) => ({
        ...current,
        [previousStatus]: current[previousStatus] + 1,
        [nextStatus]: Math.max(0, current[nextStatus] - 1),
      }));
      setError(moveError instanceof Error ? moveError.message : "Não foi possível mover a tarefa.");
    } finally {
      setMovingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  const activeFilters = [statusFilter, categoryFilter, responsibleFilter, unitFilter, dateFrom, dateTo].filter(Boolean).length;

  return (
    <AppFrame section={view === "kanban" ? "Quadro Kanban" : "Todas as Tarefas"} breadcrumbParent="Tarefas">
      <div className="page-wrap task-page">
        <div className="page-heading task-page-heading">
          <div>
            <div className="eyebrow">{view === "kanban" ? <Columns3 size={15} /> : <ListChecks size={15} />} GESTÃO DE TAREFAS</div>
            <h1>{view === "kanban" ? "Quadro Kanban" : "Tarefas"}</h1>
            <p>{view === "kanban" ? "Acompanhe e mova tarefas entre as etapas." : "Visão completa de todas as tarefas"}</p>
          </div>
          <div className="task-heading-actions">
            {view === "list" && <button className="button button-secondary" type="button" onClick={() => window.print()}>
              <Printer size={17} /> Imprimir Relatório
            </button>}
            {canCreate && (
              <button className="button button-primary" type="button" onClick={openCreate}>
                <Plus size={18} /> Nova Tarefa
              </button>
            )}
          </div>
        </div>

        {notice && <div className="feedback success-feedback" role="status"><CheckCircle2 size={17} />{notice}<button type="button" aria-label="Fechar aviso" onClick={() => setNotice("")}><X size={16} /></button></div>}
        {error && !modalOpen && <div className="feedback error-feedback" role="alert"><AlertCircle size={17} />{error}<button type="button" aria-label="Fechar erro" onClick={() => setError("")}><X size={16} /></button></div>}

        {view === "kanban" && (
          <section className="task-filter-card kanban-filter-card" aria-label="Buscar tarefas no quadro">
            <div className="task-filters">
              <label className="task-search-field">
                <Search size={17} />
                <input
                  type="search"
                  placeholder="Buscar por título ou nº do chamado..."
                  value={search}
                  onChange={(event) => { setPage(1); setSearch(event.target.value); }}
                />
              </label>
              <span className="kanban-board-total">{total} {total === 1 ? "tarefa" : "tarefas"}</span>
            </div>
          </section>
        )}

        {view === "list" && <>
        <section className="task-status-grid" aria-label="Resumo por status">
          {statusOptions.map(({ value, label }) => (
            <button
              key={value}
              className={`task-status-card status-${value.toLowerCase()}${statusFilter === value ? " selected" : ""}`}
              type="button"
              onClick={() => setStatus(value)}
              aria-pressed={statusFilter === value}
            >
              <span>{label}</span>
              <strong>{counts[value]}</strong>
            </button>
          ))}
        </section>
        </>}

        {view === "list" && (
        <section className="task-filter-card" aria-label="Filtros de tarefas">
          <div className="task-filter-heading"><Filter size={17} /><strong>Filtros</strong>{activeFilters > 0 && <span>{activeFilters} ativos</span>}</div>
          <div className="task-filters">
            <label className="task-search-field">
              <Search size={17} />
              <input
                type="search"
                placeholder="Buscar por título ou nº do chamado..."
                value={search}
                onChange={(event) => { setPage(1); setSearch(event.target.value); }}
              />
            </label>
            <label className="filter-select-label">
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }}>
                <option value="">Todos</option>
                {statusOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="filter-select-label">
              <span>Categoria</span>
              <select value={categoryFilter} onChange={(event) => { setPage(1); setCategoryFilter(event.target.value); }}>
                <option value="">Todas</option>
                {options.categorias.map((category) => <option key={category.id} value={category.id} style={{ color: category.cor }}>[{category.sigla}] {category.nome}</option>)}
              </select>
            </label>
            <label className="filter-select-label">
              <span>Responsável</span>
              <select value={responsibleFilter} onChange={(event) => { setPage(1); setResponsibleFilter(event.target.value); }}>
                <option value="">Todos</option>
                {options.usuarios.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </label>
            <label className="filter-select-label">
              <span>Unidade</span>
              <select value={unitFilter} onChange={(event) => { setPage(1); setUnitFilter(event.target.value); }}>
                <option value="">Todas</option>
                {options.unidades.map((item) => <option key={item.id} value={item.id}>{item.sigla} · {item.nome}</option>)}
              </select>
            </label>
            <label className="filter-select-label task-date-filter">
              <span>Data Criação (De)</span>
              <input type="date" value={dateFrom} onChange={(event) => { setPage(1); setDateFrom(event.target.value); }} />
            </label>
            <label className="filter-select-label task-date-filter">
              <span>Data Criação (Até)</span>
              <input type="date" value={dateTo} onChange={(event) => { setPage(1); setDateTo(event.target.value); }} />
            </label>
            {activeFilters > 0 && (
              <button className="task-clear-filters" type="button" onClick={() => {
                setSearch("");
                setStatusFilter("");
                setCategoryFilter("");
                setResponsibleFilter("");
                setUnitFilter("");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}>Limpar filtros</button>
            )}
          </div>
        </section>
        )}

        {view === "kanban" ? (
          <section className="kanban-board" aria-label="Quadro de tarefas por status">
            {loading ? (
              <div className="task-list-state kanban-loading"><LoaderCircle className="spin" size={24} />Carregando tarefas...</div>
            ) : kanbanStatuses.map(({ value, label }) => (
              <KanbanColumn
                key={value}
                status={value}
                label={label}
                count={counts[value]}
                tasks={tasks.filter((task) => task.status === value)}
                canView={canView}
                canEdit={canEdit}
                movingTaskIds={movingTaskIds}
                onView={(task) => openTask(task, true)}
                onEdit={(task) => openTask(task, false)}
                onMove={moveTask}
              />
            ))}
            {!loading && pages > 1 && (
              <div className="kanban-pagination">
                <span>Exibindo página {page} de {pages} ({tasks.length} de {total} tarefas)</span>
                <div>
                  <button className="button button-secondary" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} />Anterior</button>
                  <button className="button button-secondary" type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Próxima<ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </section>
        ) : (
        <section className="task-list-section" aria-label="Lista de tarefas">
          <div className="task-list-title">
            <h2>Todas as Tarefas</h2>
            <span>{total} {total === 1 ? "tarefa" : "tarefas"}</span>
          </div>
          {loading ? (
            <div className="task-list-state"><LoaderCircle className="spin" size={24} />Carregando tarefas...</div>
          ) : tasks.length === 0 ? (
            <div className="task-list-state task-empty-state">
              <span><FilePlus2 size={24} /></span>
              <strong>Nenhuma tarefa encontrada</strong>
              <p>{search || activeFilters ? "Ajuste os filtros e tente novamente." : "Crie a primeira tarefa para iniciar o acompanhamento."}</p>
              {canCreate && !search && activeFilters === 0 && <button className="button button-primary" type="button" onClick={openCreate}><Plus size={17} />Nova Tarefa</button>}
            </div>
          ) : (
            <div className="task-cards">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} canView={canView} canEdit={canEdit}
                  onView={() => openTask(task, true)} onEdit={() => openTask(task, false)} />
              ))}
            </div>
          )}
          {!loading && pages > 1 && (
            <div className="task-pagination">
              <span>Página {page} de {pages}</span>
              <div>
                <button className="icon-button" type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={18} /></button>
                <button className="icon-button" type="button" aria-label="Próxima página" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}><ChevronRight size={18} /></button>
              </div>
            </div>
          )}
        </section>
        )}
      </div>

      {modalOpen && portalReady && createPortal(
        <TaskModal
          form={form}
          options={options}
          saving={saving}
          error={error}
          readOnly={viewingTask !== null}
          editing={editingTask !== null}
          onClose={() => { setModalOpen(false); setError(""); }}
          onChange={updateForm}
          onToggle={toggleSelection}
          onSubmit={saveTask}
        />,
        document.body,
      )}
    </AppFrame>
  );
}

function TaskCard({ task, canView, canEdit, onView, onEdit }: {
  task: Task;
  canView: boolean;
  canEdit: boolean;
  onView: () => void;
  onEdit: () => void;
}) {
  return (
    <article className={`task-card status-border-${task.status.toLowerCase()}`}>
      <div className="task-card-main">
        <div className="task-card-topline">
          <span className="task-code">{task.codigo ?? `#${task.numero}`}</span>
          <span className={`task-status-badge status-badge-${task.status.toLowerCase()}`}>{getStatusLabel(task.status)}</span>
          {(task.category || task.categoria) && <span className="task-category-badge" style={categoryBadgeStyle(task.category)}>{task.category ? `[${task.category.sigla}] ${task.category.nome}` : task.categoria}</span>}
          <span className={`task-priority-badge priority-${task.prioridade.toLowerCase()}`}>{getPriorityLabel(task.prioridade)}</span>
          {task.unidade && <span className="task-unit-badge">{task.unidade.sigla}</span>}
          {task.privada && <span className="task-private-badge"><ShieldAlert size={13} /> Privada</span>}
          {(canView || canEdit) && (
            <div className="task-card-actions">
              {canView && <button type="button" className="icon-button" aria-label={`Visualizar ${task.titulo}`} title="Visualizar" onClick={onView}><Eye size={17} /></button>}
              {canEdit && <button type="button" className="icon-button" aria-label={`Editar ${task.titulo}`} title="Editar" onClick={onEdit}><Pencil size={16} /></button>}
            </div>
          )}
        </div>
        <h3>{task.titulo}</h3>
        {task.descricao && <p className="task-description">{task.descricao}</p>}
        <div className="task-progress">
          <div className="task-progress-label"><span>Progresso</span><strong>{task.progresso}%</strong></div>
          <div className="task-progress-track" role="progressbar" aria-valuenow={task.progresso} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso da tarefa ${task.titulo}`}>
            <span style={{ width: `${task.progresso}%` }} />
          </div>
        </div>
        <div className="task-card-footer">
          <div className="task-card-person">
            <span className="task-avatar">{initials(task.criador.nome)}</span>
            <span><small>CRIADO POR</small><strong>{task.criador.nome}</strong></span>
          </div>
          <div className="task-card-date"><small>CRIADA EM</small><strong>{formatDate(task.createdAt)}</strong></div>
          <div className={`task-card-date task-deadline${isOverdue(task) ? " overdue" : ""}`}>
            <small>PRAZO</small>
            <strong>{formatDate(task.prazo)}</strong>
            {isOverdue(task) && <span><AlertCircle size={13} /> Atrasada</span>}
          </div>
          {task.responsavel && <div className="task-card-date task-card-responsible"><small>RESPONSÁVEL</small><strong>{task.responsavel.nome}</strong></div>}
        </div>
      </div>
    </article>
  );
}

function KanbanColumn({
  status,
  label,
  count,
  tasks,
  canView,
  canEdit,
  movingTaskIds,
  onView,
  onEdit,
  onMove,
}: {
  status: TaskStatus;
  label: string;
  count: number;
  tasks: Task[];
  canView: boolean;
  canEdit: boolean;
  movingTaskIds: Set<string>;
  onView: (task: Task) => void;
  onEdit: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
}) {
  const statusIndex = kanbanStatuses.findIndex((item) => item.value === status);
  return (
    <section className={`kanban-column kanban-column-${status.toLowerCase()}`} aria-label={`${label}: ${count} tarefas`}>
      <header className="kanban-column-header">
        <span className="kanban-column-marker" />
        <h2>{label}</h2>
        <span className="kanban-column-count">{count}</span>
      </header>
      <div className="kanban-column-content">
        {tasks.length === 0 ? (
          <div className="kanban-column-empty">Nenhuma tarefa nesta etapa.</div>
        ) : tasks.map((task) => (
          <article className={`kanban-task-card${movingTaskIds.has(task.id) ? " is-moving" : ""}`} key={task.id}>
            <div className="kanban-task-topline">
              <span className="task-code">{task.codigo ?? `#${task.numero}`}</span>
              <span className={`task-priority-badge priority-${task.prioridade.toLowerCase()}`}>{getPriorityLabel(task.prioridade)}</span>
            </div>
            <h3>{task.titulo}</h3>
            {(task.category || task.categoria) && <span className="task-category-badge kanban-category" style={categoryBadgeStyle(task.category)}>{task.category ? `[${task.category.sigla}] ${task.category.nome}` : task.categoria}</span>}
            <div className="kanban-task-meta">
              {task.responsavel ? (
                <span className="kanban-assignee" title={task.responsavel.nome}>
                  <span className="task-avatar">{initials(task.responsavel.nome)}</span>
                  <span>{task.responsavel.nome}</span>
                </span>
              ) : (
                <span className="kanban-assignee kanban-unassigned">Sem responsável</span>
              )}
              <span className={`kanban-deadline${isOverdue(task) ? " overdue" : ""}`}>
                <CalendarDays size={13} /> {formatDate(task.prazo)}
              </span>
            </div>
            <div className="kanban-task-actions">
              {(canView || canEdit) && (
                <div className="kanban-open-actions">
                  {canView && <button className="icon-button" type="button" aria-label={`Visualizar ${task.titulo}`} title="Visualizar" onClick={() => onView(task)}><Eye size={15} /></button>}
                  {canEdit && <button className="icon-button" type="button" aria-label={`Editar ${task.titulo}`} title="Editar" onClick={() => onEdit(task)}><Pencil size={15} /></button>}
                </div>
              )}
              {canEdit && (
                <div className="kanban-move-actions" aria-label={`Mover ${task.titulo}`}>
                  {statusIndex > 0 && (
                    <button
                      className="kanban-move-button"
                      type="button"
                      aria-label={`Mover ${task.titulo} para ${kanbanStatuses[statusIndex - 1].label}`}
                      title={`Mover para ${kanbanStatuses[statusIndex - 1].label}`}
                      disabled={movingTaskIds.has(task.id)}
                      onClick={() => onMove(task, kanbanStatuses[statusIndex - 1].value)}
                    ><ArrowLeft size={15} /></button>
                  )}
                  {statusIndex < kanbanStatuses.length - 1 && (
                    <button
                      className="kanban-move-button"
                      type="button"
                      aria-label={`Mover ${task.titulo} para ${kanbanStatuses[statusIndex + 1].label}`}
                      title={`Mover para ${kanbanStatuses[statusIndex + 1].label}`}
                      disabled={movingTaskIds.has(task.id)}
                      onClick={() => onMove(task, kanbanStatuses[statusIndex + 1].value)}
                    ><ArrowRight size={15} /></button>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TaskModal({
  form,
  options,
  saving,
  error,
  readOnly,
  editing,
  onClose,
  onChange,
  onToggle,
  onSubmit,
}: {
  form: TaskForm;
  options: TaskOptions;
  saving: boolean;
  error: string;
  readOnly: boolean;
  editing: boolean;
  onClose: () => void;
  onChange: <K extends keyof TaskForm>(key: K, value: TaskForm[K]) => void;
  onToggle: (key: "unidadesCompartilhadas" | "colaboradoresIds", id: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const disabled = readOnly || saving;
  return (
    <div className="modal-backdrop task-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="create-modal task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <header className="task-modal-header">
          <span className="modal-icon"><ListChecks size={22} /></span>
          <div>
            <h2 id="task-modal-title">{readOnly ? "Visualizar tarefa" : editing ? "Editar tarefa" : "Nova Tarefa"}</h2>
            <p>{readOnly ? "Detalhes e acompanhamento da tarefa." : "Preencha os dados para registrar a tarefa."}</p>
          </div>
          <button className="icon-button" type="button" aria-label="Fechar formulário" onClick={onClose}><X size={18} /></button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="task-form-body">
            <div className="task-form-grid">
            <label className="form-label task-form-title">Título da Tarefa
              <input className="form-input" value={form.titulo} onChange={(event) => onChange("titulo", event.target.value)} maxLength={240} required disabled={disabled} />
            </label>
            <label className="task-private-toggle">
              <input type="checkbox" checked={form.privada} onChange={(event) => onChange("privada", event.target.checked)} disabled={disabled} />
              <span><strong>Tarefa privada</strong><small>Somente criador, responsável e colaboradores.</small></span>
            </label>
            <label className="form-label task-form-half">Data da Tarefa
              <input className="form-input" type="datetime-local" value={form.dataTarefa} onChange={(event) => onChange("dataTarefa", event.target.value)} required disabled={disabled} />
            </label>
            <label className="form-label task-form-half">Data/Hora de Entrega
              <input className="form-input" type="datetime-local" value={form.prazo} onChange={(event) => onChange("prazo", event.target.value)} disabled={disabled} />
            </label>
            <label className="form-label task-form-wide w-full">Unidade principal
              <select className="form-input w-full" value={form.unidadeId} onChange={(event) => onChange("unidadeId", event.target.value)} disabled={disabled}>
                <option value="">Sem unidade</option>
                {options.unidades.map((unit) => <option key={unit.id} value={unit.id}>{unit.sigla} · {unit.nome}</option>)}
              </select>
            </label>
            <fieldset className="task-choice-fieldset task-form-wide">
              <legend>Unidades com acesso compartilhado</legend>
              {options.unidades.length === 0 ? <small>Nenhuma unidade ativa disponível.</small> : (
                <div className="task-choice-grid">
                  {options.unidades.map((unit) => (
                    <label key={unit.id} className="task-choice">
                      <input type="checkbox" checked={form.unidadesCompartilhadas.includes(unit.id)} onChange={() => onToggle("unidadesCompartilhadas", unit.id)} disabled={disabled || form.privada} />
                      <span>{unit.sigla} · {unit.nome}</span>
                    </label>
                  ))}
                </div>
              )}
              {form.privada && <small>O compartilhamento por unidade não altera a visibilidade de uma tarefa privada.</small>}
            </fieldset>
            <label className="form-label task-form-wide">Descrição
              <textarea className="form-input form-textarea task-description-input" value={form.descricao} onChange={(event) => onChange("descricao", event.target.value)} disabled={disabled} />
            </label>
            <label className="form-label">Responsável
              <select className="form-input" value={form.responsavelId} onChange={(event) => onChange("responsavelId", event.target.value)} disabled={disabled}>
                <option value="">Não definido</option>
                {options.usuarios.map((person) => <option key={person.id} value={person.id}>{person.nome}</option>)}
              </select>
            </label>
            <label className="form-label">Categoria
              <select className="form-input" value={form.categoriaId} onChange={(event) => onChange("categoriaId", event.target.value)} disabled={disabled}>
                <option value="">Sem categoria</option>
                {options.categorias.map((category) => <option key={category.id} value={category.id} style={{ color: category.cor }}>[{category.sigla}] {category.nome}</option>)}
              </select>
            </label>
            <label className="form-label">Prioridade
              <select className="form-input" value={form.prioridade} onChange={(event) => onChange("prioridade", event.target.value as TaskPriority)} disabled={disabled}>
                {priorityOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="form-label">Status
              <select className="form-input" value={form.status} onChange={(event) => onChange("status", event.target.value as TaskStatus)} disabled={disabled}>
                {statusOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="form-label task-form-wide task-progress-input">Progresso
              <strong>{form.progresso}%</strong>
              <input type="range" min="0" max="100" step="1" value={form.progresso} onChange={(event) => onChange("progresso", Number(event.target.value))} disabled={disabled} />
            </label>
            <fieldset className="task-choice-fieldset task-form-wide">
              <legend>Colaboradores</legend>
              {options.usuarios.length === 0 ? <small>Nenhum usuário ativo disponível.</small> : (
                <div className="task-choice-grid">
                  {options.usuarios.map((person) => (
                    <label key={person.id} className="task-choice">
                      <input type="checkbox" checked={form.colaboradoresIds.includes(person.id)} onChange={() => onToggle("colaboradoresIds", person.id)} disabled={disabled} />
                      <span>{person.nome}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <label className="form-label task-form-wide">Notas Importantes / Observações
              <textarea className="form-input form-textarea task-notes-input" value={form.notasImportantes} onChange={(event) => onChange("notasImportantes", event.target.value)} disabled={disabled} />
            </label>
            </div>
          </div>
          {error && <div className="feedback error-feedback task-modal-error" role="alert"><AlertCircle size={17} />{error}</div>}
          <div className="modal-actions task-modal-actions">
            <button className="button button-secondary" type="button" onClick={onClose}>{readOnly ? "Fechar" : "Cancelar"}</button>
            {!readOnly && <button className="button button-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : editing ? <Check size={16} /> : <Plus size={16} />}{saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar Tarefa"}</button>}
          </div>
        </form>
      </section>
    </div>
  );
}
