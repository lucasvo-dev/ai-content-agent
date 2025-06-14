import { DatabaseService } from './DatabaseService';
import { Content, ContentEntity, sanitizeContent, CreateContentRequest, UpdateContentRequest, ContentType, ContentStatus } from '@/models/Content';
import { ValidationError, NotFoundError, ForbiddenError } from '@/utils/errors';
import { v4 as uuidv4 } from 'uuid';

export class ContentService {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  /**
   * Create new content
   */
  async createContent(userId: string, contentData: CreateContentRequest): Promise<Content> {
    // Validate input
    if (!contentData.projectId) {
      throw new ValidationError('Project ID is required');
    }

    if (!contentData.title?.trim()) {
      throw new ValidationError('Content title is required');
    }

    if (!contentData.body?.trim()) {
      throw new ValidationError('Content body is required');
    }

    if (contentData.title.length > 500) {
      throw new ValidationError('Title must be less than 500 characters');
    }

    // Verify user has access to project
    await this.verifyProjectAccess(contentData.projectId, userId);

    const contentId = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO content (
        id, project_id, title, body, excerpt, type, status, metadata,
        ai_generated, ai_model, ai_prompt_version, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      contentId,
      contentData.projectId,
      contentData.title.trim(),
      contentData.body.trim(),
      contentData.excerpt?.trim() || null,
      contentData.type || 'blog_post',
      contentData.status || 'draft',
      JSON.stringify(contentData.metadata || {}),
      contentData.aiGenerated || false,
      contentData.aiModel || null,
      contentData.aiPromptVersion || null,
      userId,
      now,
      now
    ];

    try {
      const result = await this.db.query<ContentEntity>(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Failed to create content');
      }

      // Create initial version
      await this.createContentVersion(contentId, result.rows[0], userId);

      return sanitizeContent(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get content by ID
   */
  async getContentById(contentId: string, userId: string): Promise<Content> {
    if (!contentId) {
      throw new ValidationError('Content ID is required');
    }

    const query = `
      SELECT c.*, p.owner_id as project_owner_id
      FROM content c
      JOIN projects p ON c.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
      WHERE c.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)
    `;

    const result = await this.db.query<ContentEntity & { project_owner_id: string }>(
      query, 
      [contentId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Content not found or access denied');
    }

    return sanitizeContent(result.rows[0]);
  }

  /**
   * Get content list with pagination and filters
   */
  async getContent(
    userId: string,
    options: {
      projectId?: string;
      type?: ContentType;
      status?: ContentStatus;
      search?: string;
      limit?: number;
      offset?: number;
      sortBy?: 'title' | 'created_at' | 'updated_at';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    content: Content[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const {
      projectId,
      type,
      status,
      search,
      limit = 20,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options;

    // Validate pagination
    if (limit > 100) {
      throw new ValidationError('Limit cannot exceed 100');
    }

    // Build WHERE clause
    let whereClause = '(p.owner_id = $1 OR pm.user_id = $1)';
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (projectId) {
      whereClause += ` AND c.project_id = $${paramIndex}`;
      queryParams.push(projectId);
      paramIndex++;
    }

    if (type) {
      whereClause += ` AND c.type = $${paramIndex}`;
      queryParams.push(type);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND c.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    if (search?.trim()) {
      whereClause += ` AND (c.title ILIKE $${paramIndex} OR c.body ILIKE $${paramIndex})`;
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Validate sort parameters
    const validSortFields = ['title', 'created_at', 'updated_at'];
    const validSortOrders = ['asc', 'desc'];
    
    if (!validSortFields.includes(sortBy)) {
      throw new ValidationError('Invalid sort field');
    }
    
    if (!validSortOrders.includes(sortOrder)) {
      throw new ValidationError('Invalid sort order');
    }

    const orderClause = `ORDER BY c.${sortBy} ${sortOrder.toUpperCase()}`;

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM content c
      JOIN projects p ON c.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE ${whereClause}
    `;

    const countResult = await this.db.query<{ total: string }>(countQuery, queryParams);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Get content
    const contentQuery = `
      SELECT DISTINCT c.*, p.name as project_name,
             u.first_name, u.last_name
      FROM content c
      JOIN projects p ON c.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const contentResult = await this.db.query<ContentEntity & { 
      project_name: string;
      first_name: string;
      last_name: string;
    }>(contentQuery, queryParams);

    const content = contentResult.rows.map(row => {
      const sanitized = sanitizeContent(row);
      return {
        ...sanitized,
        projectName: row.project_name,
        createdByName: `${row.first_name || ''} ${row.last_name || ''}`.trim()
      };
    });

    return {
      content,
      total,
      limit,
      offset
    };
  }

  /**
   * Update content
   */
  async updateContent(
    contentId: string,
    userId: string,
    updateData: UpdateContentRequest
  ): Promise<Content> {
    if (!contentId) {
      throw new ValidationError('Content ID is required');
    }

    // Get existing content and verify access
    const existingContent = await this.getContentById(contentId, userId);

    // Validate update data
    if (updateData.title !== undefined) {
      if (!updateData.title?.trim()) {
        throw new ValidationError('Content title cannot be empty');
      }
      if (updateData.title.length > 500) {
        throw new ValidationError('Title must be less than 500 characters');
      }
    }

    if (updateData.body !== undefined && !updateData.body?.trim()) {
      throw new ValidationError('Content body cannot be empty');
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (updateData.title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      queryParams.push(updateData.title.trim());
      paramIndex++;
    }

    if (updateData.body !== undefined) {
      updateFields.push(`body = $${paramIndex}`);
      queryParams.push(updateData.body.trim());
      paramIndex++;
    }

    if (updateData.excerpt !== undefined) {
      updateFields.push(`excerpt = $${paramIndex}`);
      queryParams.push(updateData.excerpt?.trim() || null);
      paramIndex++;
    }

    if (updateData.type !== undefined) {
      updateFields.push(`type = $${paramIndex}`);
      queryParams.push(updateData.type);
      paramIndex++;
    }

    if (updateData.status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      queryParams.push(updateData.status);
      paramIndex++;
    }

    if (updateData.metadata !== undefined) {
      updateFields.push(`metadata = $${paramIndex}`);
      queryParams.push(JSON.stringify(updateData.metadata));
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return existingContent; // No changes
    }

    updateFields.push(`updated_at = $${paramIndex}`);
    queryParams.push(new Date());
    paramIndex++;

    queryParams.push(contentId);

    const query = `
      UPDATE content 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await this.db.query<ContentEntity>(query, queryParams);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Content not found');
      }

      // Create new version if significant changes
      if (updateData.title || updateData.body) {
        await this.createContentVersion(contentId, result.rows[0], userId);
      }

      return sanitizeContent(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete content
   */
  async deleteContent(contentId: string, userId: string): Promise<void> {
    if (!contentId) {
      throw new ValidationError('Content ID is required');
    }

    // Verify access
    await this.getContentById(contentId, userId);

    const query = `DELETE FROM content WHERE id = $1`;
    
    const result = await this.db.query(query, [contentId]);
    
    if (result.rowCount === 0) {
      throw new NotFoundError('Content not found or already deleted');
    }
  }

  /**
   * Duplicate content
   */
  async duplicateContent(contentId: string, userId: string): Promise<Content> {
    const originalContent = await this.getContentById(contentId, userId);

    const duplicateData: CreateContentRequest = {
      projectId: originalContent.projectId,
      title: `${originalContent.title} (Copy)`,
      body: originalContent.body,
      excerpt: originalContent.excerpt,
      type: originalContent.type,
      status: 'draft',
      metadata: originalContent.metadata,
      aiGenerated: originalContent.aiGenerated,
      aiModel: originalContent.aiModel,
      aiPromptVersion: originalContent.aiPromptVersion
    };

    return await this.createContent(userId, duplicateData);
  }

  /**
   * Get content versions
   */
  async getContentVersions(contentId: string, userId: string): Promise<Array<{
    id: string;
    versionNumber: number;
    title: string;
    createdBy: string;
    createdAt: Date;
    changes: string;
  }>> {
    // Verify access
    await this.getContentById(contentId, userId);

    const query = `
      SELECT cv.*, u.first_name, u.last_name
      FROM content_versions cv
      LEFT JOIN users u ON cv.created_by = u.id
      WHERE cv.content_id = $1
      ORDER BY cv.version_number DESC
    `;

    const result = await this.db.query<{
      id: string;
      version_number: number;
      title: string;
      created_by: string;
      created_at: Date;
      metadata: any;
      first_name: string;
      last_name: string;
    }>(query, [contentId]);

    return result.rows.map(row => ({
      id: row.id,
      versionNumber: row.version_number,
      title: row.title,
      createdBy: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      createdAt: row.created_at,
      changes: row.metadata?.changes || 'Version created'
    }));
  }

  /**
   * Get content analytics summary
   */
  async getContentAnalytics(
    userId: string,
    projectId?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    totalContent: number;
    publishedContent: number;
    draftContent: number;
    aiGeneratedContent: number;
    contentByType: Record<string, number>;
    recentContent: number;
  }> {
    let whereClause = '(p.owner_id = $1 OR pm.user_id = $1)';
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (projectId) {
      whereClause += ` AND c.project_id = $${paramIndex}`;
      queryParams.push(projectId);
      paramIndex++;
    }

    if (dateFrom) {
      whereClause += ` AND c.created_at >= $${paramIndex}`;
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereClause += ` AND c.created_at <= $${paramIndex}`;
      queryParams.push(dateTo);
      paramIndex++;
    }

    const analyticsQuery = `
      SELECT 
        COUNT(c.id) as total_content,
        COUNT(CASE WHEN c.status = 'published' THEN 1 END) as published_content,
        COUNT(CASE WHEN c.status = 'draft' THEN 1 END) as draft_content,
        COUNT(CASE WHEN c.ai_generated = true THEN 1 END) as ai_generated_content,
        COUNT(CASE WHEN c.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_content,
        json_object_agg(c.type, type_count) as content_by_type
      FROM content c
      JOIN projects p ON c.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN (
        SELECT type, COUNT(*) as type_count
        FROM content c2
        JOIN projects p2 ON c2.project_id = p2.id
        LEFT JOIN project_members pm2 ON p2.id = pm2.project_id
        WHERE (p2.owner_id = $1 OR pm2.user_id = $1)
        GROUP BY type
      ) type_stats ON c.type = type_stats.type
      WHERE ${whereClause}
    `;

    const result = await this.db.query<{
      total_content: string;
      published_content: string;
      draft_content: string;
      ai_generated_content: string;
      recent_content: string;
      content_by_type: Record<string, number>;
    }>(analyticsQuery, queryParams);

    const stats = result.rows[0];

    return {
      totalContent: parseInt(stats?.total_content || '0', 10),
      publishedContent: parseInt(stats?.published_content || '0', 10),
      draftContent: parseInt(stats?.draft_content || '0', 10),
      aiGeneratedContent: parseInt(stats?.ai_generated_content || '0', 10),
      contentByType: stats?.content_by_type || {},
      recentContent: parseInt(stats?.recent_content || '0', 10)
    };
  }

  /**
   * Search content with advanced filters
   */
  async searchContent(
    userId: string,
    searchQuery: string,
    filters: {
      projectId?: string;
      type?: ContentType;
      status?: ContentStatus;
      aiGenerated?: boolean;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<Content[]> {
    if (!searchQuery?.trim()) {
      throw new ValidationError('Search query is required');
    }

    let whereClause = '(p.owner_id = $1 OR pm.user_id = $1)';
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    // Add search condition
    whereClause += ` AND (c.title ILIKE $${paramIndex} OR c.body ILIKE $${paramIndex} OR c.excerpt ILIKE $${paramIndex})`;
    queryParams.push(`%${searchQuery.trim()}%`);
    paramIndex++;

    // Add filters
    if (filters.projectId) {
      whereClause += ` AND c.project_id = $${paramIndex}`;
      queryParams.push(filters.projectId);
      paramIndex++;
    }

    if (filters.type) {
      whereClause += ` AND c.type = $${paramIndex}`;
      queryParams.push(filters.type);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND c.status = $${paramIndex}`;
      queryParams.push(filters.status);
      paramIndex++;
    }

    if (filters.aiGenerated !== undefined) {
      whereClause += ` AND c.ai_generated = $${paramIndex}`;
      queryParams.push(filters.aiGenerated);
      paramIndex++;
    }

    if (filters.dateFrom) {
      whereClause += ` AND c.created_at >= $${paramIndex}`;
      queryParams.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      whereClause += ` AND c.created_at <= $${paramIndex}`;
      queryParams.push(filters.dateTo);
      paramIndex++;
    }

    const query = `
      SELECT DISTINCT c.*, p.name as project_name
      FROM content c
      JOIN projects p ON c.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE ${whereClause}
      ORDER BY c.updated_at DESC
      LIMIT 50
    `;

    const result = await this.db.query<ContentEntity & { project_name: string }>(
      query, 
      queryParams
    );

    return result.rows.map(row => sanitizeContent(row));
  }

  /**
   * Private helper methods
   */
  private async verifyProjectAccess(projectId: string, userId: string): Promise<void> {
    const query = `
      SELECT 1 FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)
    `;

    const result = await this.db.query(query, [projectId, userId]);

    if (result.rows.length === 0) {
      throw new ForbiddenError('Access denied to project');
    }
  }

  private async createContentVersion(
    contentId: string,
    content: ContentEntity,
    userId: string
  ): Promise<void> {
    // Get current version number
    const versionQuery = `
      SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
      FROM content_versions
      WHERE content_id = $1
    `;

    const versionResult = await this.db.query<{ next_version: number }>(
      versionQuery, 
      [contentId]
    );

    const nextVersion = versionResult.rows[0]?.next_version || 1;

    // Create version record
    const insertQuery = `
      INSERT INTO content_versions (
        id, content_id, version_number, title, body, excerpt, metadata, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await this.db.query(insertQuery, [
      uuidv4(),
      contentId,
      nextVersion,
      content.title,
      content.body,
      content.excerpt,
      JSON.stringify({ changes: `Version ${nextVersion} created` }),
      userId,
      new Date()
    ]);
  }
} 