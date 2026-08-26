import type { Role } from './types';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Course {
  id: string;
  name: string;
  year: number;
  semester: number;
  createdAt: string;
  groupsCount: number;
}

export interface Term {
  year: number;
  semester: number;
}

export interface CourseAssistant {
  assistantId: string;
  active: boolean;
  createdAt?: string;
  assistant: { id: string; email: string; name: string };
}

export interface StudentSearchResult {
  id: string;
  name: string;
  email: string;
}

export type HatType = 'ASSISTANT' | 'STUDENT';

export interface MyContext {
  courseId: string;
  courseName: string;
  year: number;
  semester: number;
  hatType: HatType;
}

export interface CourseProfessor {
  professorId: string;
  authorized: boolean;
  createdAt?: string;
  professor: {
    id: string;
    email: string;
    name: string;
    role?: Role;
    isActive?: boolean;
  };
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
  componentsCount: number;
}

/** Etiqueta tal como viene embebida en un componente (sin conteo ni fecha). */
export interface TagRef {
  id: string;
  name: string;
  color: string | null;
}

export interface Component {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  totalStock: number;
  available: number;
  tags: TagRef[];
}

export interface ComponentDetail extends Component {
  inKits: number;
  inLoans: number;
}

export interface KitTemplateItem {
  component: { id: string; name: string };
  quantity: number;
}

export interface KitTemplate {
  id: string;
  name: string;
  createdAt: string;
  itemCount: number;
  items: KitTemplateItem[];
}

// --- Grupos ---

export interface Member {
  id: string;
  name: string;
  email: string;
}

export interface Group {
  id: string;
  name: string;
  courseId?: string;
  createdAt: string;
  membersCount: number;
  members: Member[];
}

export interface ImportReport {
  summary: { totalRows: number; imported: number; skipped: number; groupsCreated: number };
  createdGroups: string[];
  errors: { row: number; email: string; reason: string }[];
}

// --- Kits ---

export type KitStatus = 'ASSIGNED' | 'RETURNED';

export interface KitItem {
  id: string;
  componentId: string | null;
  componentName: string;
  quantity: number;
  returnedQuantity: number;
  pending: number;
}

export interface Kit {
  id: string;
  code: string;
  status: KitStatus;
  courseId?: string;
  groupId?: string;
  templateId: string | null;
  assignedAt: string;
  returnedAt: string | null;
  itemCount: number;
  items: KitItem[];
}

export interface Shortage {
  componentId: string;
  name: string;
  requested: number;
  available: number;
}

// --- Préstamos ---

export type LoanStatus = 'PENDIENTE' | 'PARCIAL' | 'DEVUELTO';

export interface Loan {
  id: string;
  componentId: string | null;
  componentName: string;
  quantity: number;
  returnedQuantity: number;
  pending: number;
  status: LoanStatus;
  note: string | null;
  hasPhoto: boolean;
  signedUrl: string | null;
  loanedById: string;
  loanedAt: string;
  returnedAt: string | null;
}

// --- Resumen de devoluciones ---

// --- Métricas (admin) ---

export interface MetricsOverview {
  courses: number;
  groups: number;
  students: number;
  kitsAssigned: number;
  kitsReturned: number;
  loansPending: number;
  loansTotal: number;
}

export interface StockRow {
  id: string;
  name: string;
  code: string | null;
  tags: TagRef[];
  totalStock: number;
  committedInKits: number;
  committedInLoans: number;
  available: number;
  lowStock: boolean;
}

export interface UsageRow {
  name: string;
  totalUsed: number;
  inKits: number;
  inLoans: number;
}

export interface PendingReturnsCourse {
  course: { id: string; name: string; year: number; semester: number };
  groups: {
    groupId: string;
    groupName: string;
    pendingKitItems: number;
    pendingLoans: number;
    totalPendingUnits: number;
  }[];
}

// --- Vista de estudiante (endpoints /me) ---

export interface MyGroupSummary {
  groupId: string;
  groupName: string;
  course: { id: string; name: string; year: number; semester: number };
  memberCount: number;
}

export interface MyGroupDetail {
  groupId: string;
  groupName: string;
  course: { id: string; name: string; year: number; semester: number };
  members: Member[];
  kits: {
    id: string;
    code: string;
    status: KitStatus;
    items: {
      componentName: string;
      quantity: number;
      returnedQuantity: number;
      pending: number;
    }[];
  }[];
  loans: {
    id: string;
    componentName: string;
    quantity: number;
    returnedQuantity: number;
    pending: number;
    status: LoanStatus;
    note: string | null;
    signedUrl: string | null;
  }[];
  allReturned: boolean;
}

export interface ReturnsSummary {
  groupId: string;
  allReturned: boolean;
  kits: {
    kitId: string;
    code: string;
    status: KitStatus;
    allReturned: boolean;
    items: {
      kitItemId: string;
      componentName: string;
      quantity: number;
      returnedQuantity: number;
      pending: number;
    }[];
  }[];
  loans: {
    loanId: string;
    componentName: string;
    quantity: number;
    returnedQuantity: number;
    pending: number;
  }[];
}
