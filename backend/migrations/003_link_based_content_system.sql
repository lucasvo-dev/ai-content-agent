-- Migration 003: Link-Based Content Generation System
-- Created: 2025-01-21
-- Description: Add tables for batch processing, WordPress site management, and link-based content workflow

-- Table for storing WordPress sites that users can publish to
CREATE TABLE wordpress_sites (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    site_url VARCHAR(500) NOT NULL,
    username VARCHAR(255) NOT NULL,
    application_password TEXT NOT NULL, -- encrypted
    is_active BOOLEAN DEFAULT true,
    last_tested TIMESTAMP,
    test_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'success', 'failed'
    test_error TEXT,
    site_info JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT wordpress_sites_user_id_idx CREATE INDEX ON wordpress_sites (user_id),
    CONSTRAINT wordpress_sites_active_idx CREATE INDEX ON wordpress_sites (user_id, is_active),
    CONSTRAINT wordpress_sites_status_idx CREATE INDEX ON wordpress_sites (user_id, test_status)
);

-- Table for batch processing jobs
CREATE TABLE batch_jobs (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    urls TEXT[] NOT NULL, -- Array of URLs to process
    settings JSONB NOT NULL, -- Content generation settings
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    progress JSONB DEFAULT '{"total": 0, "crawled": 0, "generated": 0, "failed": 0}',
    items JSONB DEFAULT '[]', -- Array of LinkContentItem objects
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    
    -- Indexes
    CONSTRAINT batch_jobs_project_idx CREATE INDEX ON batch_jobs (project_id),
    CONSTRAINT batch_jobs_status_idx CREATE INDEX ON batch_jobs (project_id, status),
    CONSTRAINT batch_jobs_created_idx CREATE INDEX ON batch_jobs (created_at DESC)
);

-- Table for storing scraped and generated content workflow
CREATE TABLE link_content_workflow (
    id VARCHAR(255) PRIMARY KEY,
    batch_job_id VARCHAR(255) NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,
    project_id VARCHAR(255) NOT NULL,
    source_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'crawling', 'crawled', 'generating', 'generated', 'approved', 'failed'
    scraped_content JSONB, -- ScrapedContent object
    generated_content JSONB, -- GeneratedContentResult object
    settings JSONB NOT NULL, -- ContentGenerationSettings
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT link_content_batch_idx CREATE INDEX ON link_content_workflow (batch_job_id),
    CONSTRAINT link_content_project_idx CREATE INDEX ON link_content_workflow (project_id),
    CONSTRAINT link_content_status_idx CREATE INDEX ON link_content_workflow (project_id, status),
    CONSTRAINT link_content_url_idx CREATE INDEX ON link_content_workflow (source_url)
);

-- Update existing content table to add source_url for tracking
ALTER TABLE content ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE content ADD COLUMN IF NOT EXISTS batch_job_id VARCHAR(255);
ALTER TABLE content ADD COLUMN IF NOT EXISTS link_content_id VARCHAR(255);

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS content_source_url_idx ON content (source_url);
CREATE INDEX IF NOT EXISTS content_batch_job_idx ON content (batch_job_id);
CREATE INDEX IF NOT EXISTS content_link_content_idx ON content (link_content_id);

-- Table for tracking content publishing history
CREATE TABLE content_publishing_history (
    id VARCHAR(255) PRIMARY KEY,
    content_id VARCHAR(255) NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    wordpress_site_id VARCHAR(255) NOT NULL REFERENCES wordpress_sites(id) ON DELETE CASCADE,
    external_post_id VARCHAR(255), -- WordPress post ID
    external_url TEXT, -- Published URL
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'publishing', 'published', 'failed'
    error_message TEXT,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT publishing_history_content_idx CREATE INDEX ON content_publishing_history (content_id),
    CONSTRAINT publishing_history_site_idx CREATE INDEX ON content_publishing_history (wordpress_site_id),
    CONSTRAINT publishing_history_status_idx CREATE INDEX ON content_publishing_history (status)
);

-- Table for storing content quality metrics and fine-tuning data
CREATE TABLE content_quality_metrics (
    id VARCHAR(255) PRIMARY KEY,
    content_id VARCHAR(255) NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    source_url TEXT,
    scraped_quality_score INTEGER DEFAULT 0,
    generated_quality_score INTEGER DEFAULT 0,
    user_rating INTEGER, -- 1-5 star rating from user
    user_feedback TEXT,
    ai_provider VARCHAR(50),
    processing_time_ms INTEGER,
    word_count INTEGER,
    seo_score INTEGER,
    engagement_prediction DECIMAL(5,2),
    actual_engagement JSONB, -- Real engagement metrics after publishing
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT quality_metrics_content_idx CREATE INDEX ON content_quality_metrics (content_id),
    CONSTRAINT quality_metrics_rating_idx CREATE INDEX ON content_quality_metrics (user_rating),
    CONSTRAINT quality_metrics_provider_idx CREATE INDEX ON content_quality_metrics (ai_provider)
);

-- Create views for common queries

-- View for batch job summary with statistics
CREATE OR REPLACE VIEW batch_jobs_summary AS
SELECT 
    bj.id,
    bj.project_id,
    bj.status,
    bj.created_at,
    bj.completed_at,
    (bj.progress->>'total')::int as total_urls,
    (bj.progress->>'crawled')::int as crawled_count,
    (bj.progress->>'generated')::int as generated_count,
    (bj.progress->>'failed')::int as failed_count,
    CASE 
        WHEN (bj.progress->>'total')::int > 0 
        THEN ROUND(((bj.progress->>'generated')::int * 100.0) / (bj.progress->>'total')::int, 2)
        ELSE 0 
    END as completion_percentage,
    EXTRACT(EPOCH FROM (COALESCE(bj.completed_at, NOW()) - bj.created_at)) as processing_time_seconds
FROM batch_jobs bj;

-- View for WordPress sites with connection status
CREATE OR REPLACE VIEW wordpress_sites_status AS
SELECT 
    ws.id,
    ws.user_id,
    ws.name,
    ws.site_url,
    ws.is_active,
    ws.test_status,
    ws.last_tested,
    ws.test_error,
    (ws.site_info->>'title') as site_title,
    (ws.site_info->>'description') as site_description,
    CASE 
        WHEN ws.last_tested IS NULL THEN 'never_tested'
        WHEN ws.last_tested < NOW() - INTERVAL '24 hours' THEN 'outdated'
        WHEN ws.test_status = 'success' THEN 'healthy'
        ELSE 'unhealthy'
    END as health_status
FROM wordpress_sites ws;

-- View for content ready for publishing
CREATE OR REPLACE VIEW content_ready_for_publishing AS
SELECT 
    c.id,
    c.project_id,
    c.title,
    c.type,
    c.status,
    c.source_url,
    c.batch_job_id,
    c.ai_generated,
    c.created_at,
    cqm.user_rating,
    cqm.generated_quality_score
FROM content c
LEFT JOIN content_quality_metrics cqm ON c.id = cqm.content_id
WHERE c.status = 'approved' 
    AND c.ai_generated = true
    AND c.source_url IS NOT NULL;

-- Create triggers for automatically updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_wordpress_sites_updated_at 
    BEFORE UPDATE ON wordpress_sites 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_link_content_workflow_updated_at 
    BEFORE UPDATE ON link_content_workflow 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE wordpress_sites IS 'Stores WordPress sites that users can publish content to';
COMMENT ON TABLE batch_jobs IS 'Tracks batch processing jobs for link-based content generation';
COMMENT ON TABLE link_content_workflow IS 'Manages the workflow of individual content items from URL to generated content';
COMMENT ON TABLE content_publishing_history IS 'Tracks publishing history to WordPress sites';
COMMENT ON TABLE content_quality_metrics IS 'Stores quality metrics and user feedback for fine-tuning';

COMMENT ON COLUMN wordpress_sites.application_password IS 'WordPress Application Password (encrypted)';
COMMENT ON COLUMN batch_jobs.items IS 'JSON array containing LinkContentItem objects with full workflow state';
COMMENT ON COLUMN link_content_workflow.scraped_content IS 'Full scraped content data including metadata and quality scores';
COMMENT ON COLUMN link_content_workflow.generated_content IS 'AI-generated content result with quality metrics';

-- Insert some sample data for testing (optional)
-- Note: This would be removed in production migration

-- Sample WordPress site (for testing only)
-- INSERT INTO wordpress_sites (id, user_id, name, site_url, username, application_password, site_info) 
-- VALUES (
--     'wp_test_site_001', 
--     'user_123', 
--     'Test Blog', 
--     'https://myblog.com', 
--     'admin', 
--     'base64_encoded_password_here',
--     '{"title": "My Test Blog", "description": "A test WordPress site", "categories": [{"id": 1, "name": "General", "slug": "general"}]}'
-- );

-- Migration completion
SELECT 'Migration 003 completed successfully' as status; 