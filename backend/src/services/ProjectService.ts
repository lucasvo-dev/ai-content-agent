import { DatabaseService } from './DatabaseService';
import { Project, ProjectEntity, sanitizeProject, CreateProjectRequest, UpdateProjectRequest } from '@/models/Project';
import { ValidationError, NotFoundError, ForbiddenError } from '@/utils/errors';
import { v4 as uuidv4 } from 'uuid';

export class ProjectService {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  /**
   * Create a new project
   */
  async createProject(userId: string, projectData: CreateProjectRequest): Promise<Project> {
    // Validate input
    if (!projectData.name?.trim()) {
      throw new ValidationError('Project name is required');
    }

    if (projectData.name.length > 255) {
      throw new ValidationError('Project name must be less than 255 characters');
    }

    const projectId = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO projects (
        id, name, description, owner_id, settings, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      projectId,
      projectData.name.trim(),
      projectData.description?.trim() || null,
      userId,
      JSON.stringify(projectData.settings || {}),
      now,
      now
    ];

    try {
      const result = await this.db.query<ProjectEntity>(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Failed to create project');
      }

      return sanitizeProject(result.rows[0]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key')) {
        throw new ValidationError('A project with this name already exists');
      }
      throw error;
    }
  }

  /**
   * Get project by ID
   */
  async getProjectById(projectId: string, userId: string): Promise<Project> {
    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    const query = `
      SELECT p.*, pm.role as user_role
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
      WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)
    `;

    const result = await this.db.query<ProjectEntity & { user_role?: string }>(query, [projectId, userId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Project not found or access denied');
    }

    return sanitizeProject(result.rows[0]);
  }

  /**
   * Get projects for a user with pagination
   */
  async getUserProjects(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      search?: string;
      sortBy?: 'name' | 'created_at' | 'updated_at';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    projects: Project[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const {
      limit = 20,
      offset = 0,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options;

    // Validate pagination
    if (limit > 100) {
      throw new ValidationError('Limit cannot exceed 100');
    }

    let whereClause = '(p.owner_id = $1 OR pm.user_id = $1)';
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    // Add search filter
    if (search?.trim()) {
      whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Build ORDER BY clause
    const validSortFields = ['name', 'created_at', 'updated_at'];
    const validSortOrders = ['asc', 'desc'];
    
    if (!validSortFields.includes(sortBy)) {
      throw new ValidationError('Invalid sort field');
    }
    
    if (!validSortOrders.includes(sortOrder)) {
      throw new ValidationError('Invalid sort order');
    }

    const orderClause = `ORDER BY p.${sortBy} ${sortOrder.toUpperCase()}`;

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE ${whereClause}
    `;

    const countResult = await this.db.query<{ total: string }>(countQuery, queryParams);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Get projects
    const projectsQuery = `
      SELECT DISTINCT p.*, 
             CASE WHEN p.owner_id = $1 THEN 'owner' ELSE pm.role END as user_role
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const projectsResult = await this.db.query<ProjectEntity & { user_role?: string }>(
      projectsQuery, 
      queryParams
    );

    const projects = projectsResult.rows.map(row => sanitizeProject(row));

    return {
      projects,
      total,
      limit,
      offset
    };
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string, 
    userId: string, 
    updateData: UpdateProjectRequest
  ): Promise<Project> {
    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    // Check if user has permission to update
    const existingProject = await this.getProjectById(projectId, userId);
    
    // Only owner can update project details
    if (existingProject.ownerId !== userId) {
      throw new ForbiddenError('Only project owner can update project details');
    }

    // Validate update data
    if (updateData.name !== undefined) {
      if (!updateData.name?.trim()) {
        throw new ValidationError('Project name cannot be empty');
      }
      if (updateData.name.length > 255) {
        throw new ValidationError('Project name must be less than 255 characters');
      }
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (updateData.name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      queryParams.push(updateData.name.trim());
      paramIndex++;
    }

    if (updateData.description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      queryParams.push(updateData.description?.trim() || null);
      paramIndex++;
    }

    if (updateData.settings !== undefined) {
      updateFields.push(`settings = $${paramIndex}`);
      queryParams.push(JSON.stringify(updateData.settings));
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return existingProject; // No changes
    }

    updateFields.push(`updated_at = $${paramIndex}`);
    queryParams.push(new Date());
    paramIndex++;

    queryParams.push(projectId);

    const query = `
      UPDATE projects 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await this.db.query<ProjectEntity>(query, queryParams);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Project not found');
      }

      return sanitizeProject(result.rows[0]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key')) {
        throw new ValidationError('A project with this name already exists');
      }
      throw error;
    }
  }

  /**
   * Delete project (soft delete by marking as inactive)
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    // Check if user is the owner
    const project = await this.getProjectById(projectId, userId);
    
    if (project.ownerId !== userId) {
      throw new ForbiddenError('Only project owner can delete the project');
    }

    // For now, we'll do a hard delete. In production, consider soft delete
    const query = `DELETE FROM projects WHERE id = $1 AND owner_id = $2`;
    
    const result = await this.db.query(query, [projectId, userId]);
    
    if (result.rowCount === 0) {
      throw new NotFoundError('Project not found or already deleted');
    }
  }

  /**
   * Add member to project
   */
  async addProjectMember(
    projectId: string, 
    ownerId: string, 
    memberEmail: string, 
    role: string = 'member'
  ): Promise<void> {
    // Verify project ownership
    const project = await this.getProjectById(projectId, ownerId);
    
    if (project.ownerId !== ownerId) {
      throw new ForbiddenError('Only project owner can add members');
    }

    // Find user by email
    const userQuery = `SELECT id FROM users WHERE email = $1 AND is_active = true`;
    const userResult = await this.db.query<{ id: string }>(userQuery, [memberEmail]);
    
    if (userResult.rows.length === 0) {
      throw new NotFoundError('User not found or inactive');
    }

    const memberId = userResult.rows[0].id;

    // Check if already a member
    const memberQuery = `
      SELECT 1 FROM project_members 
      WHERE project_id = $1 AND user_id = $2
    `;
    const memberResult = await this.db.query(memberQuery, [projectId, memberId]);
    
    if (memberResult.rows.length > 0) {
      throw new ValidationError('User is already a member of this project');
    }

    // Add member
    const insertQuery = `
      INSERT INTO project_members (project_id, user_id, role, permissions, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `;

    await this.db.query(insertQuery, [
      projectId,
      memberId,
      role,
      JSON.stringify({}), // Default permissions
      new Date()
    ]);
  }

  /**
   * Remove member from project
   */
  async removeProjectMember(
    projectId: string, 
    ownerId: string, 
    memberId: string
  ): Promise<void> {
    // Verify project ownership
    const project = await this.getProjectById(projectId, ownerId);
    
    if (project.ownerId !== ownerId) {
      throw new ForbiddenError('Only project owner can remove members');
    }

    // Cannot remove owner
    if (memberId === ownerId) {
      throw new ValidationError('Cannot remove project owner');
    }

    const query = `
      DELETE FROM project_members 
      WHERE project_id = $1 AND user_id = $2
    `;
    
    const result = await this.db.query(query, [projectId, memberId]);
    
    if (result.rowCount === 0) {
      throw new NotFoundError('Member not found in project');
    }
  }

  /**
   * Get project statistics
   */
  async getProjectStats(projectId: string, userId: string): Promise<{
    totalContent: number;
    publishedContent: number;
    draftContent: number;
    totalMembers: number;
    recentActivity: number;
  }> {
    // Verify access
    await this.getProjectById(projectId, userId);

    const statsQuery = `
      SELECT 
        COUNT(c.id) as total_content,
        COUNT(CASE WHEN c.status = 'published' THEN 1 END) as published_content,
        COUNT(CASE WHEN c.status = 'draft' THEN 1 END) as draft_content,
        (SELECT COUNT(*) FROM project_members WHERE project_id = $1) + 1 as total_members,
        COUNT(CASE WHEN c.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_activity
      FROM content c
      WHERE c.project_id = $1
    `;

    const result = await this.db.query<{
      total_content: string;
      published_content: string;
      draft_content: string;
      total_members: string;
      recent_activity: string;
    }>(statsQuery, [projectId]);

    const stats = result.rows[0];

    return {
      totalContent: parseInt(stats?.total_content || '0', 10),
      publishedContent: parseInt(stats?.published_content || '0', 10),
      draftContent: parseInt(stats?.draft_content || '0', 10),
      totalMembers: parseInt(stats?.total_members || '1', 10),
      recentActivity: parseInt(stats?.recent_activity || '0', 10)
    };
  }
} 