export interface TemplateColumn {
  id: string;
  name: string;
  type: string;
  position: number;
  isPrimary?: boolean;
  options?: TemplateColumnOptions;
}

export interface TemplateStatusOption {
  id: string;
  label: string;
  color: string;
  order: number;
}

export interface TemplateColumnOptions {
  statusOptions?: TemplateStatusOption[];
  [key: string]: unknown;
}

export interface TemplateGroup {
  id: string;
  name: string;
  color: string;
  position: number;
  columns: TemplateColumn[];
}

export interface CreateTemplatePayload {
  name: string;
  description?: string;
  groups: {
    name: string;
    color: string;
    position: number;
    columns: {
      name: string;
      type: string;
      position: number;
      isPrimary: boolean;
      options?: TemplateColumnOptions;
    }[];
  }[];
}

export interface BoardTemplate {
  id: number;
  name: string;
  description?: string | null;
  groups?: {
    id: number;
    name: string;
    color: string;
    position: number;
    columns?: {
      id: number;
      name: string;
      type: string;
      position: number;
      isPrimary?: boolean;
      options?: TemplateColumnOptions | TemplateStatusOption[] | null;
    }[];
  }[];
}
