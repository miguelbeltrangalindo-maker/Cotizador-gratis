/** Estado del editor de cotizaciones (reductor puro, testeable). */
import type { DraftData, DraftGroup, DraftItem } from "./schema";

export type EditorAction =
  | { type: "set"; patch: Partial<DraftData> }
  | { type: "addItem"; item: DraftItem; afterId?: string }
  | { type: "updateItem"; id: string; patch: Partial<DraftItem> }
  | { type: "removeItem"; id: string }
  | { type: "duplicateItem"; id: string; newId: string }
  | { type: "moveItem"; id: string; direction: -1 | 1 }
  | { type: "reorderItem"; activeId: string; overId: string }
  | { type: "addGroup"; group: DraftGroup }
  | { type: "updateGroup"; id: string; patch: Partial<DraftGroup> }
  | { type: "removeGroup"; id: string }
  | { type: "moveGroup"; id: string; direction: -1 | 1 }
  | { type: "setCustom"; key: string; value: string | number | boolean | null }
  | { type: "replace"; draft: DraftData };

function move<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [x] = copy.splice(from, 1);
  copy.splice(to, 0, x);
  return copy;
}

/** Orden visual: primero conceptos sin sección, luego cada sección en su orden. */
export function orderedSections(draft: Pick<DraftData, "groups" | "items">) {
  const ids = new Set(draft.groups.map((g) => g.id));
  const sections: Array<{ group: DraftGroup | null; items: DraftItem[] }> = [];
  const ungrouped = draft.items.filter((i) => !i.groupId || !ids.has(i.groupId));
  sections.push({ group: null, items: ungrouped });
  for (const g of draft.groups) sections.push({ group: g, items: draft.items.filter((i) => i.groupId === g.id) });
  return sections;
}

/** Aplana las secciones en el orden en que se ven (lo que se guarda). */
function normalizeOrder(draft: DraftData): DraftData {
  const flat = orderedSections(draft).flatMap((s) => s.items);
  return { ...draft, items: flat };
}

export function editorReducer(state: DraftData, action: EditorAction): DraftData {
  switch (action.type) {
    case "set":
      return { ...state, ...action.patch };
    case "replace":
      return action.draft;
    case "addItem": {
      const items = state.items.slice();
      const idx = action.afterId ? items.findIndex((i) => i.id === action.afterId) : -1;
      if (idx >= 0) items.splice(idx + 1, 0, action.item);
      else items.push(action.item);
      return normalizeOrder({ ...state, items });
    }
    case "updateItem":
      return { ...state, items: state.items.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i)) };
    case "removeItem":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case "duplicateItem": {
      const idx = state.items.findIndex((i) => i.id === action.id);
      if (idx < 0) return state;
      const items = state.items.slice();
      items.splice(idx + 1, 0, { ...items[idx], id: action.newId });
      return { ...state, items };
    }
    case "moveItem": {
      // Se mueve dentro de su sección.
      const item = state.items.find((i) => i.id === action.id);
      if (!item) return state;
      const sections = orderedSections(state);
      const section = sections.find((s) => s.items.some((i) => i.id === action.id))!;
      const pos = section.items.findIndex((i) => i.id === action.id);
      const target = pos + action.direction;
      if (target < 0 || target >= section.items.length) return state;
      section.items = move(section.items, pos, target);
      return { ...state, items: sections.flatMap((s) => s.items) };
    }
    case "reorderItem": {
      if (action.activeId === action.overId) return state;
      const flat = normalizeOrder(state).items;
      const from = flat.findIndex((i) => i.id === action.activeId);
      const to = flat.findIndex((i) => i.id === action.overId);
      if (from < 0 || to < 0) return state;
      const over = flat[to];
      const moved = move(flat, from, to).map((i) => (i.id === action.activeId ? { ...i, groupId: over.groupId } : i));
      return normalizeOrder({ ...state, items: moved });
    }
    case "addGroup":
      return { ...state, groups: [...state.groups, action.group] };
    case "updateGroup":
      return { ...state, groups: state.groups.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)) };
    case "removeGroup":
      return normalizeOrder({
        ...state,
        groups: state.groups.filter((g) => g.id !== action.id),
        items: state.items.map((i) => (i.groupId === action.id ? { ...i, groupId: null } : i)),
      });
    case "moveGroup": {
      const idx = state.groups.findIndex((g) => g.id === action.id);
      const target = idx + action.direction;
      if (idx < 0 || target < 0 || target >= state.groups.length) return state;
      return normalizeOrder({ ...state, groups: move(state.groups, idx, target) });
    }
    case "setCustom":
      return { ...state, customValues: { ...state.customValues, [action.key]: action.value } };
  }
}
