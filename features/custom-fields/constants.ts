export const CUSTOM_FIELD_TYPES = ["short_text", "long_text", "number", "date", "select", "checkbox"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];
export const CUSTOM_FIELD_TYPE_LABEL: Record<CustomFieldType, string> = {
  short_text: "Texto corto",
  long_text: "Texto largo",
  number: "Número",
  date: "Fecha",
  select: "Lista de opciones",
  checkbox: "Casilla (sí/no)",
};

