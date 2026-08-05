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

-- 8. Evaluation Runs table
CREATE TABLE evaluation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
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
    enable_memory BOOLEAN DEFAULT false,
    run_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 9. Evaluation Results table (Granular test case executions)
CREATE TABLE evaluation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES evaluation_runs(id) ON DELETE CASCADE,
    test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
    generated_output TEXT,
    score NUMERIC(3,2),
    is_passed BOOLEAN,
    evaluator_reasoning TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for performance
CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_system_prompts_project ON system_prompts(project_id);
CREATE INDEX idx_evaluation_prompts_project ON evaluation_prompts(project_id);
CREATE INDEX idx_test_cases_project ON test_cases(project_id);
CREATE INDEX idx_provider_configs_tenant ON provider_configs(tenant_id);
CREATE INDEX idx_evaluation_runs_project ON evaluation_runs(project_id);
CREATE INDEX idx_evaluation_results_run ON evaluation_results(run_id);

-- ==========================================
-- SEED MOCK DATA FOR LOCAL DEVELOPMENT
-- ==========================================

-- Seed default tenant
INSERT INTO tenants (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Mock Tenant');

-- Seed default user (admin / tenant master with access_role = 60)
-- Hashed password: $2a$10$uRqdKxM/8fX8699hKj7qUeM7j052uF7c.jE.m574J2yqX0eE8d89O
INSERT INTO users (id, tenant_id, email, password_hash, access_role) 
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'admin@example.com', '$2a$10$uRqdKxM/8fX8699hKj7qUeM7j052uF7c.jE.m574J2yqX0eE8d89O', 60);

-- Link tenant master_user_id
UPDATE tenants 
SET master_user_id = '00000000-0000-0000-0000-000000000002' 
WHERE id = '00000000-0000-0000-0000-000000000001';
