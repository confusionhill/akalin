---
title: "Deployment & Postgres Queue"
description: "Deploy Akalin using Docker Compose, PostgreSQL worker pools, and Cloudflare Pages."
---

# Deployment & Async Worker Pool

Akalin is designed for self-hosting with zero third-party telemetry or cloud lock-in.

---

## 1. Docker Compose Production Deployment

Spin up the Go API server and PostgreSQL container in one command:

```bash
docker compose up -d --build
```

---

## 2. PostgreSQL Worker Pool

Evaluation jobs are executed asynchronously in the background using a PostgreSQL queue powered by `FOR UPDATE SKIP LOCKED` transaction locking:
- High concurrency with zero job duplication across worker nodes.
- Real-time mid-run cancellation support for running evaluations.
