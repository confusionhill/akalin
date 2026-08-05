# Build stage
FROM golang:alpine AS builder

WORKDIR /app

# Copy dependency files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Ensure go.mod is tidy
RUN go mod tidy

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/server/main.go

# Production stage
FROM alpine:3.19

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/main .

# Expose the API port
EXPOSE 8080

# Run the application
CMD ["./main"]
