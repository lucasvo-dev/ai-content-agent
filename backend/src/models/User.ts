export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  emailVerified: boolean;
  provider?: 'local' | 'google' | 'microsoft';
  providerId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  provider?: 'local' | 'google' | 'microsoft';
  providerId?: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
  isActive?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
  role: UserRole;
  emailVerified: boolean;
  provider?: string | undefined;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'user' | 'editor';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

// Database entity interface
export interface UserEntity {
  id: string;
  email: string;
  password_hash?: string | undefined;
  first_name?: string | undefined;
  last_name?: string | undefined;
  role: UserRole;
  email_verified: boolean;
  provider?: string | undefined;
  provider_id?: string | undefined;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Utility functions
export const sanitizeUser = (user: UserEntity): UserProfile => ({
  id: user.id,
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  role: user.role,
  emailVerified: user.email_verified,
  provider: user.provider,
  isActive: user.is_active,
  createdAt: user.created_at,
  updatedAt: user.updated_at,
});

export const toAuthUser = (user: UserEntity): AuthUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  isActive: user.is_active,
}); 