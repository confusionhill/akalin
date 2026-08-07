package auth

import (
	"context"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository interface {
	GetUserByEmail(ctx context.Context, email string) (*models.User, error)
	GetUserByID(ctx context.Context, userID uuid.UUID) (*models.User, error)
	IsEmailTaken(ctx context.Context, email string, excludeUserID uuid.UUID) (bool, error)
	IsHandleTaken(ctx context.Context, handle string, excludeUserID uuid.UUID) (bool, error)
	CreateTenantWithAdminUser(ctx context.Context, tenantName, email, handle, fullName, passwordHash string) (*models.User, error)
	UpdateUserProfile(ctx context.Context, userID, tenantID uuid.UUID, email, handle, fullName string) error
	UpdateUserPassword(ctx context.Context, userID, tenantID uuid.UUID, passwordHash string) error
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

func (r *repository) CreateTenantWithAdminUser(ctx context.Context, tenantName, email, handle, fullName, passwordHash string) (*models.User, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var tenantID uuid.UUID
	err = tx.GetContext(ctx, &tenantID, "INSERT INTO tenants (name) VALUES ($1) RETURNING id", tenantName)
	if err != nil {
		return nil, err
	}

	var user models.User
	err = tx.GetContext(ctx, &user, "INSERT INTO users (tenant_id, email, handle, full_name, password_hash, access_role) VALUES ($1, $2, $3, $4, $5, 60) RETURNING *", tenantID, email, handle, fullName, passwordHash)
	if err != nil {
		return nil, err
	}

	_, err = tx.ExecContext(ctx, "UPDATE tenants SET master_user_id = $1 WHERE id = $2", user.ID, tenantID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *repository) UpdateUserProfile(ctx context.Context, userID, tenantID uuid.UUID, email, handle, fullName string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE users SET email = $1, handle = $2, full_name = $3, updated_at = NOW() WHERE id = $4 AND tenant_id = $5", email, handle, fullName, userID, tenantID)
	return err
}

func (r *repository) UpdateUserPassword(ctx context.Context, userID, tenantID uuid.UUID, passwordHash string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3", passwordHash, userID, tenantID)
	return err
}
