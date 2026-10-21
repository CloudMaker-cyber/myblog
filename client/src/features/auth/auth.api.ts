import { api } from '../../lib/api';

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

export type AuthResult = {
  token: string;
  user: AuthUser;
};

export type LoginInput = {
  identifier: string;
  password: string;
};

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
};

export function loginRequest(input: LoginInput): Promise<AuthResult> {
  return api.post<AuthResult>('/sessions', input);
}

export function registerRequest(input: RegisterInput): Promise<AuthResult> {
  return api.post<AuthResult>('/users', input);
}

export function logoutRequest(): Promise<void> {
  return api.delete('/sessions/current');
}

export function fetchMe(): Promise<{ user: AuthUser }> {
  return api.get<{ user: AuthUser }>('/users/me');
}

export type ProfileInput = {
  avatarUrl: string | null;
  bio: string | null;
};

export function updateProfileRequest(input: ProfileInput): Promise<{ user: AuthUser }> {
  return api.patch<{ user: AuthUser }>('/users/me', input);
}
