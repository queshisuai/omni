export interface AuthenticatedUser {
  userId: number;
  phone?: string;
  role?: string;
}

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user: AuthenticatedUser;
}
