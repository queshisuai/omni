# Docker Infrastructure Design

## Goal

Package local development middleware into Docker so Redis, PostgreSQL, and Nacos can be started consistently with one command. Application services remain host-run through the existing PowerShell and Maven/npm workflow.

## Scope

In scope:
- Add Docker Compose infrastructure for PostgreSQL, Redis, and Nacos.
- Preserve host-facing ports used by the current project: PostgreSQL `5432`, Redis `6379`, Nacos `8848`.
- Add a PowerShell infrastructure starter that checks Docker availability, starts the Compose stack, and waits for required ports.
- Add a `start-project.ps1` switch to use Docker infrastructure instead of local Windows PostgreSQL and local `C:\nacos`.
- Document the new startup path.

Out of scope:
- Containerizing Java microservices, NestJS grab-service, or the Next.js frontend.
- Changing application datasource, Nacos, or Redis defaults away from `localhost`.
- Production deployment hardening.

## Architecture

The local machine remains the application runtime. Docker only owns middleware:

```text
Host Java/NestJS/Frontend
  -> localhost:5432  PostgreSQL container
  -> localhost:6379  Redis container
  -> localhost:8848  Nacos container
```

Docker Compose will define named volumes so database and Nacos state survive container restarts. Redis can use a named volume as well, but local development does not require Redis persistence for correctness.

## Components

### docker-compose.yml

Defines:
- `postgres`: PostgreSQL 17 with `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=123456`, and initial default database `postgres`.
- `redis`: Redis 7 Alpine on port `6379`.
- `nacos`: Nacos standalone on port `8848`.

Container names should be stable and project-prefixed, such as `omni-postgres`, `omni-redis`, and `omni-nacos`.

### scripts/start-infra.ps1

Responsibilities:
- Verify `docker` is installed and Docker Engine is reachable.
- Run `docker compose up -d postgres redis nacos`.
- Wait for TCP ports `5432`, `6379`, and `8848`.
- Print clear next-step output for running the application startup script.

The script should be idempotent: running it repeatedly should reuse existing containers and volumes.

### start-project.ps1

Add a `-UseDockerInfra` switch.

When enabled:
- Call `scripts/start-infra.ps1`.
- Skip Windows `postgresql-x64-17` service startup.
- Skip local `C:\nacos` / `D:\nacos` startup.
- Continue launching Java services, grab-service, and frontend exactly as today.

When disabled:
- Preserve the current local PostgreSQL/Nacos behavior for backward compatibility.

## Data Initialization

The Compose stack only starts infrastructure. Existing database creation, migrations, and seed workflows remain unchanged.

Because the current `prod-split` startup expects these databases:
- `omni_user`
- `omni_ticket_split`
- `omni_order`
- `omni_payment`
- `omni_notification`
- `omni_grab`

the implementation should provide either a lightweight init SQL mounted into PostgreSQL or a documented one-time creation command. The safer default is to add an explicit init SQL for empty Docker volumes so first startup works without manual database creation.

## Error Handling

The infrastructure script should fail early with actionable messages when:
- Docker CLI is missing.
- Docker Engine is not running.
- A required host port is already occupied by a non-Docker process.
- A container starts but a required port does not become reachable within the timeout.

Port conflicts should not silently fall back to local services; that would make the runtime source ambiguous.

## Testing

Verification should include:
- `docker compose config` succeeds.
- `scripts/start-infra.ps1` starts the middleware stack.
- `Test-NetConnection localhost -Port 5432`, `6379`, and `8848` succeeds.
- `docker exec omni-redis redis-cli ping` returns `PONG`.
- `start-project.ps1 -UseDockerInfra -SkipJava -SkipFrontend -SkipInstall` completes the infrastructure path without trying local PostgreSQL or local Nacos.

Full application verification can remain a separate step because this change targets local infrastructure startup.
