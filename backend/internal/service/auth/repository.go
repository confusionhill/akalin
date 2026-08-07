package auth

import (
	"context"
	"time"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository interface {
	GetUserByEmail(ctx context.Context, email string) (*models.User, error)
	GetUserByID(ctx context.Context, userID uuid.UUID) (*models.User, error)
	IsEmailTaken(ctx context.Context, email string, excludeUserID uuid.UUID) (bool, error)
	IsHandleTaken(ctx context.Context, handle string, excludeUserID uuid.UUID) (bool, error)
	CreateUser(ctx context.Context, email, handle, fullName, passwordHash string) (*models.User, error)
	CreateTenant(ctx context.Context, tenantName string, userID uuid.UUID) (*models.Tenant, error)
	GetTenantsForUser(ctx context.Context, userID uuid.UUID) ([]models.Tenant, error)
	GetTenantUserRole(ctx context.Context, tenantID, userID uuid.UUID) (int, error)
	GetTenantUsers(ctx context.Context, tenantID uuid.UUID) ([]models.TenantUserResponse, error)
	RemoveTenantUser(ctx context.Context, tenantID, userID uuid.UUID) error
	CreateInvitation(ctx context.Context, tenantID uuid.UUID, email string, accessRole int, token string, expiresAt time.Time) (*models.TenantInvitation, error)
	GetInvitationByToken(ctx context.Context, token string) (*models.TenantInvitation, error)
	DeleteInvitation(ctx context.Context, tokenID uuid.UUID) error
	AddUserToTenant(ctx context.Context, tenantID, userID uuid.UUID, accessRole int) error
	UpdateUserProfile(ctx context.Context, userID uuid.UUID, email, handle, fullName string) error
	UpdateUserPassword(ctx context.Context, userID uuid.UUID, passwordHash string) error
}

type repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) Repository {
	return &repository{db: db}
}

func (r *repository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	err := r.db.GetContext(ctx, &user, "SELECT * FROM users WHERE email = $1", email)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *repository) GetUserByID(ctx context.Context, userID uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.db.GetContext(ctx, &user, "SELECT * FROM users WHERE id = $1", userID)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *repository) IsEmailTaken(ctx context.Context, email string, excludeUserID uuid.UUID) (bool, error) {
	var count int
	var err error
	if excludeUserID == uuid.Nil {
		err = r.db.GetContext(ctx, &count, "SELECT COUNT(*) FROM users WHERE email = $1", email)
	} else {
		err = r.db.GetContext(ctx, &count, "SELECT COUNT(*) FROM users WHERE email = $1 AND id != $2", email, excludeUserID)
	}
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *repository) IsHandleTaken(ctx context.Context, handle string, excludeUserID uuid.UUID) (bool, error) {
	var count int
	var err error
	if excludeUserID == uuid.Nil {
		err = r.db.GetContext(ctx, &count, "SELECT COUNT(*) FROM users WHERE handle = $1", handle)
	} else {
		err = r.db.GetContext(ctx, &count, "SELECT COUNT(*) FROM users WHERE handle = $1 AND id != $2", handle, excludeUserID)
	}
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *repository) CreateUser(ctx context.Context, email, handle, fullName, passwordHash string) (*models.User, error) {
	var user models.User
	err := r.db.GetContext(ctx, &user, "INSERT INTO users (email, handle, full_name, password_hash) VALUES ($1, $2, $3, $4) RETURNING *", email, handle, fullName, passwordHash)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *repository) CreateTenant(ctx context.Context, tenantName string, userID uuid.UUID) (*models.Tenant, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var tenant models.Tenant
	err = tx.GetContext(ctx, &tenant, "INSERT INTO tenants (name, master_user_id) VALUES ($1, $2) RETURNING *", tenantName, userID)
	if err != nil {
		return nil, err
	}

	_, err = tx.ExecContext(ctx, "INSERT INTO tenant_users (tenant_id, user_id, access_role) VALUES ($1, $2, 60)", tenant.ID, userID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &tenant, nil
}

func (r *repository) GetTenantsForUser(ctx context.Context, userID uuid.UUID) ([]models.Tenant, error) {
	var tenants []models.Tenant
	query := `
		SELECT t.* FROM tenants t
		INNER JOIN tenant_users tu ON t.id = tu.tenant_id
		WHERE tu.user_id = $1
		ORDER font BY tu.joined_at DESC
	`
	// Fallback to simple select if ORDER BY tu.joined_at fails
	query = `
		SELECT t.* FROM tenants t
		INNER JOIN tenant_users tu ON t.id = tu.tenant_id
		WHERE tu.user_id = $1
	`
	err := r.db.SelectContext(ctx, &tenants, query, userID)
	if err != nil {
		return nil, err
	}
	return tenants, nil
}

func (r *repository) GetTenantUserRole(ctx context.Context, tenantID, userID uuid.UUID) (int, error) {
	var role int
	err := r.db.GetContext(ctx, &role, "SELECT access_role FROM tenant_users WHERE tenant_id = $1 AND user_id = $2", tenantID, userID)
	if err != nil {
		return -1, err
	}
	return role, nil
}

func (r *repository) GetTenantUsers(ctx context.Context, tenantID uuid.UUID) ([]models.TenantUserResponse, error) {
	var users []models.TenantUserResponse
	query := `
		SELECT u.id AS user_id, u.email, u.handle, u.full_name, tu.access_role, tu.joined_at
		FROM users u
		INNER JOIN tenant_users tu ON u.id = tu.user_id
		WHERE tu.tenant_id = $1
		ORDER BY tu.joined_at ASC
	`
	err := r.db.SelectContext(ctx, &users, query, tenantID)
	if err != nil {
		return nil, err
	}
	return users, nil
}

func (r *repository) RemoveTenantUser(ctx context.Context, tenantID, userID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM tenant_users WHERE tenant_id = $1 AND user_id = $2", tenantID, userID)
	return err
}

func (r *repository) CreateInvitation(ctx context.Context, tenantID uuid.UUID, email string, accessRole int, token string, expiresAt time.Time) (*models.TenantInvitation, error) {
	var invite models.TenantInvitation
	query := `
		INSERT INTO tenant_invitations (tenant_id, email, access_role, token, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING *
	`
	err := r.db.GetContext(ctx, &invite, query, tenantID, email, accessRole, token, expiresAt)
	if err != nil {
		return nil, err
	}
	return &invite, nil
}

func (r *repository) GetInvitationByToken(ctx context.Context, token string) (*models.TenantInvitation, error) {
	var invite models.TenantInvitation
	err := r.db.GetContext(ctx, &invite, "SELECT * FROM tenant_invitations WHERE token = $1", token)
	if err != nil {
		return nil, err
	}
	return &invite, nil
}

func (r *repository) DeleteInvitation(ctx context.Context, tokenID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM tenant_invitations WHERE id = $1", tokenID)
	return err
}

func (r *repository) AddUserToTenant(ctx context.Context, tenantID, userID uuid.UUID, accessRole int) error {
	_, err := r.db.ExecContext(ctx, "INSERT INTO tenant_users (tenant_id, user_id, access_role) VALUES ($1, $2, $3) ON CONFLICT (tenant_id, user_id) DO UPDATE SET access_role = $3", tenantID, userID, accessRole)
	return err
}

func (r *repository) UpdateUserProfile(ctx context.Context, userID uuid.UUID, email, handle, fullName string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE users SET email = $1, handle = $2, full_name = $3, updated_at = NOW() WHERE id = $4", email, handle, fullName, userID)
	return err
}

func (r *repository) UpdateUserPassword(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", passwordHash, userID)
	return err
}
