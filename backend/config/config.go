package config

import (
	"log"
	"os"
	"time"
)

type Config struct {
	DatabaseURL   string
	JWTSigningKey string
	JWTExpiration time.Duration
	Port          string
}

func Load() *Config {
	return &Config{
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/llmeval?sslmode=disable"),
		JWTSigningKey: getEnv("JWT_SIGNING_KEY", "dev-secret-key-change-this-in-production"),
		JWTExpiration: 168 * time.Hour, // 1 week
	}
}

func getEnv(key, defaultValue string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	if defaultValue != "" {
		log.Printf("Using default value for %s: %s", key, defaultValue)
	}
	return defaultValue
}
