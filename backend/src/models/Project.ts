export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  settings: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectSettings {
  defaultBrandVoice?: BrandVoiceConfig;
  targetAudience?: string;
  defaultKeywords?: string[];
  contentTypes?: string[];
  publishingDefaults?: PublishingDefaults;
}

export interface BrandVoiceConfig {
  tone: 'professional' | 'casual' | 'friendly' | 'authoritative' | 'conversational';
  style: 'formal' | 'conversational' | 'technical' | 'creative';
  vocabulary: 'simple' | 'advanced' | 'industry-specific';
  length: 'concise' | 'detailed' | 'comprehensive';
}

export interface PublishingDefaults {
  wordpress?: {
    defaultStatus: 'draft' | 'publish' | 'private';
    defaultCategories?: string[];
    defaultTags?: string[];
  };
  facebook?: {
    defaultScheduleTime?: string;
    defaultAudience?: 'public' | 'friends' | 'custom';
  };
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  settings?: Partial<ProjectSettings>;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  settings?: Partial<ProjectSettings>;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  role: ProjectRole;
  permissions: ProjectPermissions;
  createdAt: Date;
}

export type ProjectRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface ProjectPermissions {
  canCreateContent: boolean;
  canEditContent: boolean;
  canDeleteContent: boolean;
  canPublishContent: boolean;
  canManageConnections: boolean;
  canViewAnalytics: boolean;
  canManageMembers: boolean;
}

// Database entity interfaces
export interface ProjectEntity {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  settings: ProjectSettings;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectMemberEntity {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  permissions: ProjectPermissions;
  created_at: Date;
}

// Utility functions
export const sanitizeProject = (project: ProjectEntity): Project => ({
  id: project.id,
  name: project.name,
  description: project.description || undefined,
  ownerId: project.owner_id,
  settings: project.settings,
  createdAt: project.created_at,
  updatedAt: project.updated_at,
});

export const getDefaultPermissions = (role: ProjectRole): ProjectPermissions => {
  switch (role) {
    case 'owner':
      return {
        canCreateContent: true,
        canEditContent: true,
        canDeleteContent: true,
        canPublishContent: true,
        canManageConnections: true,
        canViewAnalytics: true,
        canManageMembers: true,
      };
    case 'admin':
      return {
        canCreateContent: true,
        canEditContent: true,
        canDeleteContent: true,
        canPublishContent: true,
        canManageConnections: true,
        canViewAnalytics: true,
        canManageMembers: false,
      };
    case 'editor':
      return {
        canCreateContent: true,
        canEditContent: true,
        canDeleteContent: false,
        canPublishContent: true,
        canManageConnections: false,
        canViewAnalytics: true,
        canManageMembers: false,
      };
    case 'viewer':
      return {
        canCreateContent: false,
        canEditContent: false,
        canDeleteContent: false,
        canPublishContent: false,
        canManageConnections: false,
        canViewAnalytics: true,
        canManageMembers: false,
      };
    default:
      return getDefaultPermissions('viewer');
  }
}; 