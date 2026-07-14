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

export interface Component {
  id: string;
  name: string;
  description: string | null;
  totalStock: number;
  available: number;
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
