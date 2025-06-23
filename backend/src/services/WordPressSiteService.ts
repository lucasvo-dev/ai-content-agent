import { DatabaseService } from './DatabaseService';
import axios from 'axios';

export interface WordPressSite {
  id: string;
  userId: string;
  name: string;
  siteUrl: string;
  username: string;
  applicationPassword: string; // Encrypted
  isActive: boolean;
  lastTested?: Date;
  testStatus?: 'success' | 'failed' | 'pending';
  testError?: string;
  siteInfo?: {
    title: string;
    description: string;
    version: string;
    timezone: string;
    dateFormat: string;
    categories: Array<{ id: number; name: string; slug: string }>;
    tags: Array<{ id: number; name: string; slug: string }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WordPressSiteConfig {
  name: string;
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export class WordPressSiteService {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  /**
   * Add a new WordPress site for a user
   */
  async addWordPressSite(userId: string, config: WordPressSiteConfig): Promise<WordPressSite> {
    // Validate the WordPress connection first
    const testResult = await this.testWordPressConnection(config);
    
    if (!testResult.success) {
      throw new Error(`WordPress connection failed: ${testResult.error}`);
    }

    const siteId = this.generateId();
    const site: WordPressSite = {
      id: siteId,
      userId,
      name: config.name,
      siteUrl: this.normalizeUrl(config.siteUrl),
      username: config.username,
      applicationPassword: await this.encryptPassword(config.applicationPassword),
      isActive: true,
      lastTested: new Date(),
      testStatus: 'success',
      siteInfo: testResult.siteInfo,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.saveWordPressSite(site);
    return site;
  }

  /**
   * Get all WordPress sites for a user
   */
  async getUserWordPressSites(userId: string): Promise<WordPressSite[]> {
    const result = await this.db.query(
      'SELECT * FROM wordpress_sites WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return result.rows.map(row => this.deserializeWordPressSite(row));
  }

  /**
   * Get a specific WordPress site by ID
   */
  async getWordPressSite(siteId: string): Promise<WordPressSite | null> {
    const result = await this.db.query(
      'SELECT * FROM wordpress_sites WHERE id = $1',
      [siteId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.deserializeWordPressSite(result.rows[0]);
  }

  /**
   * Update WordPress site
   */
  async updateWordPressSite(siteId: string, updates: Partial<WordPressSiteConfig>): Promise<WordPressSite> {
    const site = await this.getWordPressSite(siteId);
    if (!site) {
      throw new Error('WordPress site not found');
    }

    // Apply updates
    if (updates.name) site.name = updates.name;
    if (updates.siteUrl) site.siteUrl = this.normalizeUrl(updates.siteUrl);
    if (updates.username) site.username = updates.username;
    if (updates.applicationPassword) {
      site.applicationPassword = await this.encryptPassword(updates.applicationPassword);
    }

    site.updatedAt = new Date();

    // Test connection if credentials changed
    if (updates.siteUrl || updates.username || updates.applicationPassword) {
      const testConfig: WordPressSiteConfig = {
        name: site.name,
        siteUrl: site.siteUrl,
        username: site.username,
        applicationPassword: updates.applicationPassword || await this.decryptPassword(site.applicationPassword)
      };

      const testResult = await this.testWordPressConnection(testConfig);
      site.lastTested = new Date();
      site.testStatus = testResult.success ? 'success' : 'failed';
      site.testError = testResult.error;
      site.siteInfo = testResult.siteInfo;
    }

    await this.saveWordPressSite(site);
    return site;
  }

  /**
   * Delete WordPress site
   */
  async deleteWordPressSite(siteId: string): Promise<void> {
    await this.db.query('DELETE FROM wordpress_sites WHERE id = $1', [siteId]);
  }

  /**
   * Test WordPress connection
   */
  async testWordPressConnection(config: WordPressSiteConfig): Promise<{
    success: boolean;
    error?: string;
    siteInfo?: WordPressSite['siteInfo'];
  }> {
    try {
      const baseUrl = this.normalizeUrl(config.siteUrl);
      const auth = Buffer.from(`${config.username}:${config.applicationPassword}`).toString('base64');

      // Test 1: Check if WordPress REST API is available
      const apiCheck = await axios.get(`${baseUrl}/wp-json/wp/v2`, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });

      if (apiCheck.status === 404) {
        return {
          success: false,
          error: 'WordPress REST API not found. Please ensure WordPress is properly configured.'
        };
      }

      // Test 2: Authenticate and get user info
      const userResponse = await axios.get(`${baseUrl}/wp-json/wp/v2/users/me`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (userResponse.status !== 200) {
        return {
          success: false,
          error: 'Authentication failed. Please check your username and application password.'
        };
      }

      // Test 3: Get site information
      const [siteInfoResponse, categoriesResponse] = await Promise.allSettled([
        axios.get(`${baseUrl}/wp-json/wp/v2/settings`, {
          headers: { 'Authorization': `Basic ${auth}` },
          timeout: 10000
        }),
        axios.get(`${baseUrl}/wp-json/wp/v2/categories?per_page=100`, {
          headers: { 'Authorization': `Basic ${auth}` },
          timeout: 10000
        })
      ]);

      let siteInfo: WordPressSite['siteInfo'] = {
        title: 'Unknown',
        description: '',
        version: 'Unknown',
        timezone: 'UTC',
        dateFormat: 'F j, Y',
        categories: [],
        tags: []
      };

      if (siteInfoResponse.status === 'fulfilled') {
        const settings = siteInfoResponse.value.data;
        siteInfo = {
          title: settings.title || 'Unknown',
          description: settings.description || '',
          version: settings.gmt_offset ? 'WordPress (detected)' : 'Unknown',
          timezone: settings.timezone_string || 'UTC',
          dateFormat: settings.date_format || 'F j, Y',
          categories: [],
          tags: []
        };
      }

      if (categoriesResponse.status === 'fulfilled') {
        siteInfo.categories = categoriesResponse.value.data.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug
        }));
      }

      return {
        success: true,
        siteInfo
      };

    } catch (error: any) {
      let errorMessage = 'Connection failed';

      if (error.code === 'ENOTFOUND') {
        errorMessage = 'Website not found. Please check the URL.';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused. Please check if the website is accessible.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please check your username and application password.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Access forbidden. Please check your user permissions.';
      } else if (error.response?.status === 404) {
        errorMessage = 'WordPress REST API not found at this URL.';
      } else if (error.timeout) {
        errorMessage = 'Connection timeout. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Test all WordPress sites for a user
   */
  async testAllUserSites(userId: string): Promise<void> {
    const sites = await this.getUserWordPressSites(userId);
    
    for (const site of sites) {
      if (!site.isActive) continue;

      try {
        const config: WordPressSiteConfig = {
          name: site.name,
          siteUrl: site.siteUrl,
          username: site.username,
          applicationPassword: await this.decryptPassword(site.applicationPassword)
        };

        const testResult = await this.testWordPressConnection(config);
        
        // Update site test status
        await this.db.query(
          `UPDATE wordpress_sites 
           SET last_tested = $1, test_status = $2, test_error = $3, site_info = $4
           WHERE id = $5`,
          [
            new Date(),
            testResult.success ? 'success' : 'failed',
            testResult.error || null,
            JSON.stringify(testResult.siteInfo || {}),
            site.id
          ]
        );

      } catch (error) {
        await this.db.query(
          `UPDATE wordpress_sites 
           SET last_tested = $1, test_status = $2, test_error = $3
           WHERE id = $4`,
          [new Date(), 'failed', error.message, site.id]
        );
      }
    }
  }

  /**
   * Get WordPress sites available for publishing
   */
  async getAvailableSitesForPublishing(userId: string): Promise<WordPressSite[]> {
    const sites = await this.getUserWordPressSites(userId);
    return sites.filter(site => 
      site.isActive && 
      site.testStatus === 'success' && 
      (!site.lastTested || (Date.now() - site.lastTested.getTime()) < 24 * 60 * 60 * 1000) // Tested within 24 hours
    );
  }

  /**
   * Save WordPress site to database
   */
  private async saveWordPressSite(site: WordPressSite): Promise<void> {
    const query = `
      INSERT INTO wordpress_sites (
        id, user_id, name, site_url, username, application_password,
        is_active, last_tested, test_status, test_error, site_info,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        site_url = EXCLUDED.site_url,
        username = EXCLUDED.username,
        application_password = EXCLUDED.application_password,
        is_active = EXCLUDED.is_active,
        last_tested = EXCLUDED.last_tested,
        test_status = EXCLUDED.test_status,
        test_error = EXCLUDED.test_error,
        site_info = EXCLUDED.site_info,
        updated_at = EXCLUDED.updated_at
    `;

    await this.db.query(query, [
      site.id,
      site.userId,
      site.name,
      site.siteUrl,
      site.username,
      site.applicationPassword,
      site.isActive,
      site.lastTested,
      site.testStatus,
      site.testError,
      JSON.stringify(site.siteInfo || {}),
      site.createdAt,
      site.updatedAt
    ]);
  }

  /**
   * Deserialize WordPress site from database row
   */
  private deserializeWordPressSite(row: any): WordPressSite {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      siteUrl: row.site_url,
      username: row.username,
      applicationPassword: row.application_password,
      isActive: row.is_active,
      lastTested: row.last_tested ? new Date(row.last_tested) : undefined,
      testStatus: row.test_status,
      testError: row.test_error,
      siteInfo: row.site_info ? JSON.parse(row.site_info) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Normalize URL (ensure no trailing slash, add https if needed)
   */
  private normalizeUrl(url: string): string {
    let normalized = url.trim();
    
    // Add protocol if missing
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }
    
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    
    return normalized;
  }

  /**
   * Encrypt password (placeholder - use proper encryption in production)
   */
  private async encryptPassword(password: string): Promise<string> {
    // In production, use proper encryption like crypto.encrypt
    // For now, just return the password (this should be encrypted!)
    return Buffer.from(password).toString('base64');
  }

  /**
   * Decrypt password (placeholder - use proper decryption in production)
   */
  private async decryptPassword(encryptedPassword: string): Promise<string> {
    // In production, use proper decryption like crypto.decrypt
    // For now, just decode the base64
    return Buffer.from(encryptedPassword, 'base64').toString();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `wp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
} 