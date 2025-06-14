import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { 
  User, 
  CreateUserRequest, 
  UpdateUserRequest, 
  UserProfile, 
  UserEntity, 
  sanitizeUser,
  UserRole 
} from '../models/User';
import { DatabaseService } from './DatabaseService';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors';

export class UserService {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Create a new user
   */
  async createUser(userData: CreateUserRequest): Promise<UserProfile> {
    // Validate email format
    if (!this.isValidEmail(userData.email)) {
      throw new ValidationError('Invalid email format');
    }

    // Check if user already exists
    const existingUser = await this.findUserByEmail(userData.email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password if provided (for local auth)
    let passwordHash: string | undefined;
    if (userData.password) {
      passwordHash = await bcrypt.hash(userData.password, 12);
    }

    const userId = uuidv4();
    const now = new Date();

    const userEntity: Omit<UserEntity, 'created_at' | 'updated_at'> = {
      id: userId,
      email: userData.email.toLowerCase(),
      password_hash: passwordHash,
      first_name: userData.firstName,
      last_name: userData.lastName,
      role: 'user' as UserRole,
      email_verified: userData.provider !== 'local', // Auto-verify for SSO
      provider: userData.provider || 'local',
      provider_id: userData.providerId,
      is_active: true,
    };

    const query = `
      INSERT INTO users (
        id, email, password_hash, first_name, last_name, 
        role, email_verified, provider, provider_id, is_active,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      ) RETURNING *
    `;

    const values = [
      userEntity.id,
      userEntity.email,
      userEntity.password_hash,
      userEntity.first_name,
      userEntity.last_name,
      userEntity.role,
      userEntity.email_verified,
      userEntity.provider,
      userEntity.provider_id,
      userEntity.is_active,
      now,
      now,
    ];

    const result = await this.db.query(query, values);
    return sanitizeUser(result.rows[0]);
  }

  /**
   * Find user by ID
   */
  async findUserById(userId: string): Promise<UserProfile | null> {
    const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
    const result = await this.db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return sanitizeUser(result.rows[0]);
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<UserEntity | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.db.query(query, [email.toLowerCase()]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Find user by provider ID
   */
  async findUserByProvider(provider: string, providerId: string): Promise<UserEntity | null> {
    const query = 'SELECT * FROM users WHERE provider = $1 AND provider_id = $2';
    const result = await this.db.query(query, [provider, providerId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, updateData: UpdateUserRequest): Promise<UserProfile> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updateData.firstName !== undefined) {
      updateFields.push(`first_name = $${paramIndex++}`);
      values.push(updateData.firstName);
    }

    if (updateData.lastName !== undefined) {
      updateFields.push(`last_name = $${paramIndex++}`);
      values.push(updateData.lastName);
    }

    if (updateData.emailVerified !== undefined) {
      updateFields.push(`email_verified = $${paramIndex++}`);
      values.push(updateData.emailVerified);
    }

    if (updateData.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      values.push(updateData.isActive);
    }

    if (updateFields.length === 0) {
      return user;
    }

    updateFields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return sanitizeUser(result.rows[0]);
  }

  /**
   * Verify user password
   */
  async verifyPassword(email: string, password: string): Promise<UserEntity | null> {
    const user = await this.findUserByEmail(email);
    if (!user || !user.password_hash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    return isValid ? user : null;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.findUserByEmail(''); // Need to get user by ID first
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.password_hash && !await bcrypt.compare(currentPassword, user.password_hash)) {
      throw new ValidationError('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    
    const query = 'UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3';
    await this.db.query(query, [newPasswordHash, new Date(), userId]);
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string): Promise<void> {
    const query = 'UPDATE users SET is_active = false, updated_at = $1 WHERE id = $2';
    await this.db.query(query, [new Date(), userId]);
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<{
    totalProjects: number;
    totalContent: number;
    publishedContent: number;
  }> {
    const projectsQuery = 'SELECT COUNT(*) as count FROM projects WHERE owner_id = $1';
    const contentQuery = `
      SELECT 
        COUNT(*) as total_content,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_content
      FROM content c
      JOIN projects p ON c.project_id = p.id
      WHERE p.owner_id = $1
    `;

    const [projectsResult, contentResult] = await Promise.all([
      this.db.query(projectsQuery, [userId]),
      this.db.query(contentQuery, [userId]),
    ]);

    return {
      totalProjects: parseInt(projectsResult.rows[0].count),
      totalContent: parseInt(contentResult.rows[0].total_content || '0'),
      publishedContent: parseInt(contentResult.rows[0].published_content || '0'),
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * List users with pagination (admin only)
   */
  async listUsers(
    limit: number = 20, 
    offset: number = 0,
    search?: string
  ): Promise<{ users: UserProfile[]; total: number }> {
    let query = 'SELECT * FROM users WHERE is_active = true';
    let countQuery = 'SELECT COUNT(*) FROM users WHERE is_active = true';
    const values: any[] = [];
    let paramIndex = 1;

    if (search) {
      const searchCondition = ` AND (email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`;
      query += searchCondition;
      countQuery += searchCondition;
      values.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    const [usersResult, countResult] = await Promise.all([
      this.db.query(query, values),
      this.db.query(countQuery, search ? [values[0]] : []),
    ]);

    return {
      users: usersResult.rows.map(sanitizeUser),
      total: parseInt(countResult.rows[0].count),
    };
  }
} 