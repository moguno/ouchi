import { useEffect, useState } from "react";
import "./styles/project-sidebar.css";
import type { PortalProject } from "./types";

interface ProjectSidebarProps {
  projects: PortalProject[];
  activeProjectId?: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (project: PortalProject) => void;
  onDelete: (project: PortalProject) => void;
  /** Demo mode: projects can be browsed, but not created or edited. */
  actionsDisabled?: boolean;
}

export function projectInitial(name: string): string {
  return [...name.trim()][0] ?? "?";
}

/**
 * The project side menu. A project holds one whole ouchi and shares
 * nothing with other projects, so selecting one here switches the
 * entire portal — board, management and memo views alike.
 */
export function ProjectSidebar({
  projects,
  activeProjectId,
  collapsed,
  onToggleCollapsed,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  actionsDisabled = false,
}: ProjectSidebarProps) {
  // Which row's ⋯ menu is open, if any. One menu at a time; it
  // closes on an outside pointer-down, on Escape, and after an
  // item is picked.
  const [menuProjectId, setMenuProjectId] = useState<string | undefined>(
    undefined,
  );
  useEffect(() => {
    if (menuProjectId === undefined) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (
        !target?.closest(".ouchi-project-menu, .ouchi-project-menubtn")
      ) {
        setMenuProjectId(undefined);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuProjectId(undefined);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuProjectId]);

  return (
    <aside
      aria-label="プロジェクト"
      className={`ouchi-project-sidebar${collapsed ? " is-collapsed" : ""}`}
    >
      <div className="ouchi-project-sidebar-head">
        {!collapsed && (
          <span className="ouchi-project-sidebar-title">プロジェクト</span>
        )}
        <button
          aria-label={collapsed ? "サイドメニューを開く" : "サイドメニューを畳む"}
          className="ouchi-project-handle"
          onClick={onToggleCollapsed}
          type="button"
        >
          {collapsed ? ">|" : "|<"}
        </button>
      </div>

      {collapsed ? (
        <div className="ouchi-project-rail">
          {projects.map((project) => (
            <button
              aria-label={project.name}
              aria-pressed={project.id === activeProjectId}
              className={`ouchi-project-rail-icon${
                project.id === activeProjectId ? " is-active" : ""
              }`}
              key={project.id}
              onClick={() => onSelect(project.id)}
              style={{ background: project.color }}
              title={project.name}
              type="button"
            >
              {projectInitial(project.name)}
            </button>
          ))}
          <button
            aria-label="プロジェクトを追加"
            className="ouchi-project-rail-add"
            disabled={actionsDisabled}
            onClick={onAdd}
            type="button"
          >
            ＋
          </button>
        </div>
      ) : (
        <div className="ouchi-project-list">
          {projects.map((project) => {
            const active = project.id === activeProjectId;
            return (
              <div
                className={`ouchi-project-row${active ? " is-active" : ""}`}
                key={project.id}
                onClick={() => onSelect(project.id)}
              >
                <span
                  aria-hidden="true"
                  className="ouchi-project-disc"
                  style={{ background: project.color }}
                >
                  {projectInitial(project.name)}
                </span>
                <span className="ouchi-project-names">
                  <span className="ouchi-project-name">{project.name}</span>
                  <span className="ouchi-project-ptitle">{project.title}</span>
                </span>
                <button
                  aria-expanded={menuProjectId === project.id}
                  aria-haspopup="menu"
                  aria-label={`${project.name}のメニュー`}
                  className="ouchi-project-menubtn"
                  disabled={actionsDisabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenuProjectId((current) =>
                      current === project.id ? undefined : project.id,
                    );
                  }}
                  type="button"
                >
                  ⋯
                </button>
                {menuProjectId === project.id && (
                  <div className="ouchi-project-menu" role="menu">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuProjectId(undefined);
                        onEdit(project);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <span aria-hidden="true">✎</span>編集
                    </button>
                    <button
                      className="is-delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuProjectId(undefined);
                        onDelete(project);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <span aria-hidden="true">🗑</span>削除
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <button
            className="ouchi-project-add"
            disabled={actionsDisabled}
            onClick={onAdd}
            type="button"
          >
            ＋ プロジェクトを追加
          </button>
        </div>
      )}
    </aside>
  );
}
