import type { Role } from './types';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  /** Rol principal derivado (mayor privilegio de `roles`). */
  role: Role;
  roles: Role[];
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

/** Un registro de devolución: cantidad, observación, quién la recibió y cuándo. */
export interface ReturnEvent {
  id: string;
  quantity: number;
  note: string | null;
  receivedBy: { id: string; name: string };
  createdAt: string;
}

export interface KitItem {
  id: string;
  componentId: string | null;
  componentName: string;
  quantity: number;
  returnedQuantity: number;
  pending: number;
  /** "Recibido conforme" marcado por el alumno en la verificación de entrega. */
  verified: boolean;
  /** Discrepancia reportada por el alumno; se registra, no ajusta cantidades. */
  verificationNote: string | null;
  /** Historial de devoluciones, de la más antigua a la más reciente. */
  returnEvents: ReturnEvent[];
  /** Algún evento del historial trae observación. */
  hasReturnNotes: boolean;
}

/** Estado de aceptación de condiciones de un integrante del grupo. */
export interface KitAcceptanceMember {
  studentId: string;
  name: string;
  accepted: boolean;
  acceptedAt: string | null;
}

export interface KitAcceptanceSummary {
  accepted: number;
  total: number;
  /** Nombres de quienes aún no aceptan. */
  pending: string[];
  members: KitAcceptanceMember[];
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

  // --- Verificación de entrega (Fase 9b) ---
  isVerified: boolean;
  verifiedAt: string | null;
  hasDiscrepancies: boolean;
  /** Formato "2/3". */
  acceptanceStatus: string;
  allAccepted: boolean;
  /** Solo en el detalle (GET .../kits/:kitId). */
  verifiedBy?: { id: string; name: string } | null;
  /** Solo en el detalle. */
  acceptances?: KitAcceptanceSummary;
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
  returnEvents: ReturnEvent[];
  hasReturnNotes: boolean;
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
    /** El kit ya fue verificado por algún integrante del grupo. */
    isVerified: boolean;
    /** El usuario actual ya aceptó las condiciones de ESTE kit. */
    hasAccepted: boolean;
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
    /** Algún ítem del kit tiene observaciones de devolución. */
    hasReturnNotes: boolean;
    items: {
      kitItemId: string;
      componentName: string;
      quantity: number;
      returnedQuantity: number;
      pending: number;
      returnEvents: ReturnEvent[];
      hasReturnNotes: boolean;
    }[];
  }[];
  loans: {
    loanId: string;
    componentName: string;
    quantity: number;
    returnedQuantity: number;
    pending: number;
    returnEvents: ReturnEvent[];
    hasReturnNotes: boolean;
  }[];
}

// --- Verificación de entrega y condiciones de préstamo (Fase 9b) ---

export interface LoanTerms {
  version: string;
  title: string;
  body: string;
}

export interface MyKitItem {
  id: string;
  componentName: string;
  quantity: number;
  verified: boolean;
  verificationNote: string | null;
}

/** Kit visto por el alumno para verificarlo y aceptar condiciones. */
export interface MyKitDetail {
  id: string;
  code: string;
  status: KitStatus;
  assignedAt: string;
  groupId: string;
  groupName: string;
  items: MyKitItem[];
  verifiedAt: string | null;
  verifiedBy: { id: string; name: string } | null;
  members: KitAcceptanceMember[];
  isVerified: boolean;
  /** El usuario actual ya aceptó. */
  hasAccepted: boolean;
  /** Fecha en que aceptó el usuario actual (null si aún no acepta). */
  myAcceptedAt: string | null;
  allAccepted: boolean;
  /** Versión vigente del texto; se reenvía al aceptar. */
  termsVersion: string;
}

// --- Resumen agregado del curso (Fase 10c) ---

export interface CourseOverviewTotals {
  groups: number;
  students: number;
  kitsAssigned: number;
  kitsVerified: number;
  kitsPendingVerification: number;
  acceptancesSigned: number;
  acceptancesTotal: number;
  acceptancesPending: number;
  groupsAllReturned: number;
  groupsWithPending: number;
  itemsPendingReturn: number;
  loansPendingReturn: number;
  /** Ítems de kit no verificados o con nota, sobre kits ya verificados. */
  discrepancies: number;
}

export interface CourseOverviewGroup {
  groupId: string;
  groupName: string;
  memberCount: number;
  kit: {
    id: string;
    code: string;
    status: KitStatus;
    isVerified: boolean;
    verifiedAt: string | null;
    hasDiscrepancies: boolean;
  } | null;
  acceptance: {
    signed: number;
    total: number;
    pendingMembers: { id: string; name: string; email: string }[];
  };
  returns: {
    allReturned: boolean;
    pendingKitUnits: number;
    pendingLoanUnits: number;
    hasReturnNotes: boolean;
  };
  /** Falta verificar, faltan firmas, hay discrepancias o quedan devoluciones. */
  needsAttention: boolean;
}

export interface CourseOverview {
  course: { id: string; name: string; year: number; semester: number };
  totals: CourseOverviewTotals;
  groups: CourseOverviewGroup[];
}
