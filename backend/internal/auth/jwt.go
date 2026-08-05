package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID   uuid.UUID `json:"user_id"`
	TenantID uuid.UUID `json:"tenant_id"`
	jwt.RegisteredClaims
}

type JWTManager struct {
	secretKey      []byte
	expirationTime int // in minutes
}

func NewJWTManager(secretKey string, expirationTime int) *JWTManager {
	return &JWTManager{
		secretKey:      []byte(secretKey),
		expirationTime: expirationTime,
	}
}

// GenerateToken creates a JWT token for a user
func (j *JWTManager) GenerateToken(tenantID, userID uuid.UUID) (string, error) {
	claims := &Claims{
		UserID:   userID,
		TenantID: tenantID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute * time.Duration(j.expirationTime))),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "llm-eval-dashboard",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(j.secretKey)
}

// ValidateToken validates a JWT token and returns claims
func (j *JWTManager) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return j.secretKey, nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}