export interface IUser {
  id: string;
  name: string;
  nickname: string;
  phone: string;
  studentId?: string;
  studentEmail?: string;
  role: "admin" | "user";
  createdAt?: unknown;
  status: "active" | "suspend";
  updatedAt?: unknown;
}

export interface ISession {
  id: string;
  name: string;
  nickname: string;
  phone: string;
  role: "admin" | "user";
  status: "active" | "suspend";
}

export interface IAuthResult {
  success: boolean;
  session?: ISession;
  error?: string;
}

export interface IUpdateUserPayload {
  name: string;
  nickname: string;
  studentId: string;
  studentEmail: string;
  identityImage?: string;
  consent?: boolean;
  phone: string;
  role: "admin" | "user";
  status: "active" | "suspend";
}

export interface ICreateUserPayload {
  name: string;
  nickname: string;
  studentId: string;
  studentEmail: string;
  identityImage: string;
  consent: boolean;
  phone: string;
  password: string;
  role: "admin" | "user";
  status: "active" | "suspend";
}

export interface IUserOption {
  id: string;
  name: string;
  nickname: string;
  phone: string;
  status: "active" | "suspend";
}

export interface AuthContextType {
  session: ISession | null;
  login: (session: ISession) => void;
  logout: () => void;
}

export interface IUserListItem {
  id: string;
  name: string;
  nickname: string;
  phone: string;
  studentId?: string;
  studentEmail?: string;
  role: "admin" | "user";
  status: "active" | "suspend";
  updatedAt?: unknown;
}
