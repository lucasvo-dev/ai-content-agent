import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../config/env';

export class DatabaseService {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor() {
    this.pool = new Pool({
      connectionString: config.SUPABASE_URL,
      ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    });

    this.setupEventHandlers();
  }

  /**
   * Initialize database connection
   */
  async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Execute a query
   */
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.isConnected && config.SUPABASE_URL !== 'placeholder-url') {
      throw new Error('Database not connected');
    }

    // For development with placeholder database
    if (config.SUPABASE_URL === 'placeholder-url') {
      console.log('🔧 Mock database query:', text, params);
      return {
        rows: [],
        rowCount: 0,
        command: '',
        oid: 0,
        fields: [],
      };
    }

    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        console.warn(`⚠️ Slow query detected (${duration}ms):`, text);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Database query error:', error);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.isConnected && config.SUPABASE_URL !== 'placeholder-url') {
      throw new Error('Database not connected');
    }

    // For development with placeholder database
    if (config.SUPABASE_URL === 'placeholder-url') {
      console.log('🔧 Mock database transaction');
      // Create a mock client for development
      const mockClient = {
        query: async (text: string, params?: any[]) => {
          console.log('🔧 Mock transaction query:', text, params);
          return {
            rows: [],
            rowCount: 0,
            command: '',
            oid: 0,
            fields: [],
          };
        },
        release: () => {},
      } as any;
      
      return await callback(mockClient);
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool for complex operations
   */
  async getClient(): Promise<PoolClient> {
    if (!this.isConnected && config.SUPABASE_URL !== 'placeholder-url') {
      throw new Error('Database not connected');
    }

    return await this.pool.connect();
  }

  /**
   * Close all connections
   */
  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      console.log('✅ Database disconnected successfully');
    } catch (error) {
      console.error('❌ Error disconnecting from database:', error);
      throw error;
    }
  }

  /**
   * Check if database is healthy
   */
  async healthCheck(): Promise<boolean> {
    if (config.SUPABASE_URL === 'placeholder-url') {
      return true; // Always healthy in development mode
    }

    try {
      const result = await this.query('SELECT 1 as health');
      return result.rows.length > 0 && result.rows[0].health === 1;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Get connection pool stats
   */
  getPoolStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Setup event handlers for the pool
   */
  private setupEventHandlers(): void {
    this.pool.on('connect', (client) => {
      console.log('🔗 New database client connected');
    });

    this.pool.on('acquire', (client) => {
      console.log('📥 Database client acquired from pool');
    });

    this.pool.on('remove', (client) => {
      console.log('📤 Database client removed from pool');
    });

    this.pool.on('error', (err, client) => {
      console.error('❌ Unexpected error on idle database client:', err);
    });
  }

  /**
   * Execute multiple queries in a single transaction
   */
  async batchQuery(queries: Array<{ text: string; params?: any[] }>): Promise<QueryResult[]> {
    return await this.transaction(async (client) => {
      const results: QueryResult[] = [];
      
      for (const query of queries) {
        const result = await client.query(query.text, query.params);
        results.push(result);
      }
      
      return results;
    });
  }

  /**
   * Create database tables (for development/testing)
   */
  async createTables(): Promise<void> {
    if (config.SUPABASE_URL === 'placeholder-url') {
      console.log('🔧 Mock table creation - skipping in development mode');
      return;
    }

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50) DEFAULT 'user',
        email_verified BOOLEAN DEFAULT false,
        provider VARCHAR(50) DEFAULT 'local',
        provider_id VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    const createProjectsTable = `
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    const createContentTable = `
      CREATE TABLE IF NOT EXISTS content (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        body TEXT NOT NULL,
        excerpt TEXT,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'draft',
        metadata JSONB DEFAULT '{}',
        ai_generated BOOLEAN DEFAULT false,
        ai_model VARCHAR(100),
        ai_prompt_version VARCHAR(20),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);
      CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
      CREATE INDEX IF NOT EXISTS idx_content_project ON content(project_id);
      CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
      CREATE INDEX IF NOT EXISTS idx_content_type ON content(type);
    `;

    try {
      await this.batchQuery([
        { text: createUsersTable },
        { text: createProjectsTable },
        { text: createContentTable },
        { text: createIndexes },
      ]);
      
      console.log('✅ Database tables created successfully');
    } catch (error) {
      console.error('❌ Error creating database tables:', error);
      throw error;
    }
  }
} 