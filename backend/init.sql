-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    master_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    handle VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    access_role INTEGER NOT NULL DEFAULT 0, -- 0 = user, 60 = admin / tenant master
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tenants ADD CONSTRAINT fk_tenants_master_user FOREIGN KEY (master_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. System Prompts table (Versioned)
CREATE TABLE system_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Evaluation Prompts table (Versioned Rubrics)
CREATE TABLE evaluation_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Test Cases table
CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    input_prompt TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    expected_format VARCHAR(50) DEFAULT 'plain_text',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Provider Configs table (BYOK) — tenant-scoped (global, reusable across projects)
CREATE TABLE provider_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    base_url VARCHAR(255) NOT NULL,
    api_key VARCHAR(255),
    custom_headers JSONB,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tools table (Tenant-scoped global mock tools)
CREATE TABLE tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb,
    result TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Project Tools junction table
CREATE TABLE project_tools (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, tool_id)
);

-- 10. Evaluation Configs table (Preset configurations for re-usable run settings)
CREATE TABLE evaluation_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    system_prompt_id UUID REFERENCES system_prompts(id) ON DELETE SET NULL,
    evaluation_prompt_id UUID REFERENCES evaluation_prompts(id) ON DELETE SET NULL,
    target_provider_id UUID REFERENCES provider_configs(id) ON DELETE SET NULL,
    target_model VARCHAR(100) NOT NULL,
    evaluator_provider_id UUID REFERENCES provider_configs(id) ON DELETE SET NULL,
    evaluator_model VARCHAR(100) NOT NULL,
    pass_threshold NUMERIC(3,2) DEFAULT 0.80,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Evaluation Runs table
CREATE TABLE evaluation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    config_id UUID REFERENCES evaluation_configs(id) ON DELETE SET NULL,
    system_prompt_id UUID REFERENCES system_prompts(id) ON DELETE SET NULL,
    evaluation_prompt_id UUID REFERENCES evaluation_prompts(id) ON DELETE SET NULL,
    target_provider_id UUID REFERENCES provider_configs(id) ON DELETE SET NULL,
    target_model VARCHAR(100) NOT NULL,
    evaluator_provider_id UUID REFERENCES provider_configs(id) ON DELETE SET NULL,
    evaluator_model VARCHAR(100) NOT NULL,
    model_used VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
    pass_threshold NUMERIC(3,2),
    is_passed BOOLEAN,
    average_score NUMERIC(3,2),
    failure_reason TEXT,
    blacklisted_test_case_ids JSONB DEFAULT '[]'::jsonb,
    blacklisted_tool_ids JSONB DEFAULT '[]'::jsonb,
    enable_memory BOOLEAN DEFAULT false,
    run_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 12. Evaluation Results table (Granular test case executions)
CREATE TABLE evaluation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES evaluation_runs(id) ON DELETE CASCADE,
    test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
    generated_output TEXT,
    score NUMERIC(3,2),
    is_passed BOOLEAN,
    evaluator_reasoning TEXT,
    tools_called JSONB DEFAULT '[]'::jsonb,
    trace JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Rubric Drafts table (Auto-Refinement)
CREATE TABLE rubric_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',   -- pending, running, completed, failed, cancelled
    draft_content TEXT,                      -- the generated rubric
    failure_reason TEXT,
    payload JSONB,                           -- stores original calibration request config
    source_run_id UUID,                     -- NULL for CSV mode
    base_prompt_id UUID REFERENCES evaluation_prompts(id) ON DELETE SET NULL,  -- selected foundation prompt
    base_prompt_version INT,                -- version of that prompt (denormalized for display)
    results_analyzed INT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 14. LLM Models table (Tenant-scoped global model configs)
CREATE TABLE llm_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES provider_configs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for performance
CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_system_prompts_project ON system_prompts(project_id);
CREATE INDEX idx_evaluation_prompts_project ON evaluation_prompts(project_id);
CREATE INDEX idx_test_cases_project ON test_cases(project_id);
CREATE INDEX idx_provider_configs_tenant ON provider_configs(tenant_id);
CREATE INDEX idx_tools_tenant ON tools(tenant_id);
CREATE INDEX idx_project_tools_project ON project_tools(project_id);
CREATE INDEX idx_evaluation_runs_project ON evaluation_runs(project_id);
CREATE INDEX idx_evaluation_results_run ON evaluation_results(run_id);
CREATE INDEX idx_rubric_drafts_project ON rubric_drafts(project_id);
CREATE INDEX idx_llm_models_tenant ON llm_models(tenant_id);
CREATE INDEX idx_llm_models_provider ON llm_models(provider_id);
CREATE INDEX idx_evaluation_configs_project ON evaluation_configs(project_id);

-- ==========================================
-- SEED MOCK DATA FOR LOCAL DEVELOPMENT
-- ==========================================

-- Seed default tenant
INSERT INTO tenants (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Mock Tenant');

-- Seed default user (admin / tenant master with access_role = 60)
-- Hashed password for 'password': $2a$10$wT1B5s27bT1jN6r7N0K3s.q4b.6rG5oFzN6.5V.vB8m8Q5j1Y0Y.a
INSERT INTO users (id, tenant_id, email, handle, full_name, password_hash, access_role) 
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'admin@example.com', 'confusion_hill', 'Admin User', '$2a$10$8s5qM8299K58x5uX.4lR1O0e6n.X/Yy.Xz.Xz.Xz.Xz.Xz.Xz.Xz', 60);

-- Link tenant master_user_id
UPDATE tenants 
SET master_user_id = '00000000-0000-0000-0000-000000000002' 
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Seed Global Mock Tools
INSERT INTO tools (id, tenant_id, name, description, parameters, result, created_by)
VALUES 
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'get_weather', 'Get current weather for a location', '{"type": "object", "properties": {"city": {"type": "string"}}}'::jsonb, 'in {{city}} weather is 72F', '00000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'calculator', 'Perform basic mathematical calculations', '{}'::jsonb, '{"result": 42}', '00000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'search_database', 'Search customer database by query', '{}'::jsonb, '{"records": [{"id": 1, "name": "John Doe", "status": "active"}]}', '00000000-0000-0000-0000-000000000002');

-- Seed Mock Project for Tool Calling Evaluation
INSERT INTO projects (id, tenant_id, name, description, created_by)
VALUES 
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Tool Calling Evaluation', 'Project to evaluate LLM tool calling behavior and prompt instruction adherence.', '00000000-0000-0000-0000-000000000002');

-- Link Tools to Project
INSERT INTO project_tools (project_id, tool_id)
VALUES 
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');

-- Seed System Prompt for Tool Calling Project
INSERT INTO system_prompts (id, project_id, content, version, created_by)
VALUES 
('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'You are an AI assistant equipped with tools. Use the get_weather tool when asked about weather, and calculator for math calculations. If a request does not require tools, answer directly without invoking tools.', 1, '00000000-0000-0000-0000-000000000002');

-- Seed Evaluation Prompt for Tool Calling Project
INSERT INTO evaluation_prompts (id, project_id, content, version, created_by)
VALUES 
('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Grade the response on a scale of 0.0 to 1.0 based on correctness, appropriate tool usage, and conciseness.', 1, '00000000-0000-0000-0000-000000000002');

-- Seed Test Cases for Tool Calling Project
INSERT INTO test_cases (id, project_id, input_prompt, expected_output, expected_format, created_by)
VALUES 
('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'What is the current weather in San Francisco?', 'The current weather in San Francisco is 72°F and Sunny.', 'plain_text', '00000000-0000-0000-0000-000000000002'),
('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Write a short poem about the ocean.', 'Waves whisper soft upon the golden shore...', 'plain_text', '00000000-0000-0000-0000-000000000002'),
('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Get weather for San Francisco in JSON format', '{"city": "San Francisco", "temperature": 72, "unit": "F", "condition": "Sunny"}', 'json', '00000000-0000-0000-0000-000000000002');

