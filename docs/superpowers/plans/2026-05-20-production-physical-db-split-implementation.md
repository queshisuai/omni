# 生产物理数据库拆分 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 产出五个独立 PostgreSQL 实例的一次性停机拆库实施资产，包括生产拆库 manifest、导出/导入脚本、SQL 安全检查、服务 `prod-split` 配置、验证脚本和 cutover checklist。

**Architecture:** 不手写整套大表 DDL，而是用受控 manifest 驱动 `pg_dump` 按服务导出 `pre-data` schema 和 data，再用显式 same-owner constraint SQL 补回服务内部外键。目标库不重建 cross-owner FK，服务通过 `prod-split` profile 或环境变量连接各自数据库。

**Tech Stack:** PowerShell 5.1、PostgreSQL `pg_dump`/`psql`、Spring Boot profile、Maven、现有 `scripts/verify-microservice-boundaries.ps1`。

---

## 文件结构

创建以下文件：

- `sql/production-split/manifest.json`：唯一表归属和目标库拓扑 manifest，供脚本读取。
- `sql/production-split/user/001_same_owner_constraints.sql`：`java-user` 目标库 same-owner FK 和索引补充。
- `sql/production-split/ticket/001_same_owner_constraints.sql`：`java-ticket` 目标库 same-owner FK 和索引补充。
- `sql/production-split/order/001_same_owner_constraints.sql`：`java-order` 目标库 same-owner FK 和索引补充。
- `sql/production-split/payment/001_same_owner_constraints.sql`：`java-payment` 目标库 same-owner FK 和索引补充。
- `sql/production-split/notification/001_same_owner_constraints.sql`：`java-notification` 目标库索引补充；不包含跨服务 FK。
- `scripts/check-production-split-sql.ps1`：静态检查生产拆库 SQL，不允许引用 `sql/local/*`、不允许 cross-owner FK、要求 owner 注释。
- `scripts/export-production-split.ps1`：按 manifest 从共享库导出每个服务的 schema/data artifact。
- `scripts/import-production-split.ps1`：把 artifact 导入五个目标数据库，并应用 same-owner SQL。
- `scripts/verify-production-split-runtime.ps1`：迁移后检查 datasource 指向、目标库连接、cross-owner FK 不存在、关键服务端口健康。
- `docs/operations/production-db-split-cutover-checklist.md`：人工切换 checklist，覆盖停机、备份、导出、导入、验证、回滚。
- `java/java-user/src/main/resources/application-prod-split.yml`：user 服务生产拆库 profile。
- `java/java-ticket/src/main/resources/application-prod-split.yml`：ticket 服务生产拆库 profile。
- `java/java-order/src/main/resources/application-prod-split.yml`：order 服务生产拆库 profile。
- `java/java-payment/src/main/resources/application-prod-split.yml`：payment 服务生产拆库 profile。
- `java/java-notification/src/main/resources/application-prod-split.yml`：notification 服务生产拆库 profile。

修改以下文件：

- `scripts/verify-microservice-boundaries.ps1`：追加生产拆库 SQL 静态检查。
- `docs/microservices/service-boundaries.md`：补充生产拆库实施资产和验收命令。
- `CLAUDE.md`：补充 `prod-split` profile、生产拆库脚本和禁止事项。

---

### Task 1: 新增生产拆库 manifest

**Files:**
- Create: `sql/production-split/manifest.json`

- [ ] **Step 1: 创建 manifest 文件**

写入以下完整内容：

```json
{
  "sourceDatabase": "omni_ticket",
  "services": [
    {
      "service": "java-user",
      "key": "user",
      "targetInstance": "pg-user",
      "targetDatabase": "omni_user",
      "tables": ["user", "user_auth", "sms_code", "organizer_application"]
    },
    {
      "service": "java-ticket",
      "key": "ticket",
      "targetInstance": "pg-ticket",
      "targetDatabase": "omni_ticket",
      "tables": ["category", "artist", "tour", "station", "activity", "venue", "venue_application", "session", "ticket_type", "ticket_type_area", "session_seat", "venue_area", "venue_seat", "reservation", "seat", "stock_log", "venue_seat_layout_template", "venue_seat_layout_template_section", "venue_default_layout", "venue_default_layout_section", "activity_seat_layout", "activity_seat_layout_section", "session_seat_layout", "session_seat_layout_section", "seat_block", "seat_override", "ticket_group", "layout_section"]
    },
    {
      "service": "java-order",
      "key": "order",
      "targetInstance": "pg-order",
      "targetDatabase": "omni_order",
      "tables": ["order", "order_seat", "order_snapshot"]
    },
    {
      "service": "java-payment",
      "key": "payment",
      "targetInstance": "pg-payment",
      "targetDatabase": "omni_payment",
      "tables": ["payment", "refund_request"]
    },
    {
      "service": "java-notification",
      "key": "notification",
      "targetInstance": "pg-notification",
      "targetDatabase": "omni_notification",
      "tables": ["notification"]
    }
  ]
}
```

- [ ] **Step 2: 验证 JSON 可解析**

Run: `powershell -NoProfile -Command "Get-Content -Raw -LiteralPath 'sql/production-split/manifest.json' | ConvertFrom-Json | Out-Null; 'manifest ok'"`

Expected: 输出 `manifest ok`。

- [ ] **Step 3: Commit**

```powershell
git add sql/production-split/manifest.json
git commit -m "chore: add production split manifest"
```

---

### Task 2: 新增 production split SQL 静态检查

**Files:**
- Create: `scripts/check-production-split-sql.ps1`
- Modify: `scripts/verify-microservice-boundaries.ps1`

- [ ] **Step 1: 创建检查脚本**

写入以下完整内容：

```powershell
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$splitRoot = Join-Path -Path $repoRoot -ChildPath "sql/production-split"
$manifestFile = Join-Path -Path $splitRoot -ChildPath "manifest.json"

if (-not (Test-Path -LiteralPath $manifestFile)) {
    Write-Host "FAIL missing production split manifest: $manifestFile"
    exit 1
}

$manifest = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
$expectedKeys = @("user", "ticket", "order", "payment", "notification")

foreach ($key in $expectedKeys) {
    $dir = Join-Path -Path $splitRoot -ChildPath $key
    if (-not (Test-Path -LiteralPath $dir)) {
        Write-Host "FAIL missing production split directory: $dir"
        exit 1
    }
}

$tableOwner = @{}
foreach ($service in $manifest.services) {
    foreach ($table in $service.tables) {
        $normalized = $table.ToLower()
        if ($tableOwner.ContainsKey($normalized)) {
            Write-Host "FAIL table assigned to multiple services: $table"
            exit 1
        }
        $tableOwner[$normalized] = $service.key
    }
}

$sqlFiles = Get-ChildItem -Path $splitRoot -Filter "*.sql" -Recurse | Sort-Object FullName
if ($sqlFiles.Count -eq 0) {
    Write-Host "FAIL no production split SQL files found"
    exit 1
}

$forbiddenText = @(
    "sql/local/",
    "20260520_drop_cross_owner_fks_local_only.sql",
    "20260520_move_tables_to_service_schemas_local_only.sql",
    "DROP DATABASE",
    "DROP SCHEMA"
)

foreach ($file in $sqlFiles) {
    $content = Get-Content -Raw -LiteralPath $file.FullName
    if ($content -notmatch '(?m)^-- owner: java-(user|ticket|order|payment|notification)') {
        Write-Host "FAIL SQL file missing owner comment: $($file.FullName)"
        exit 1
    }
    foreach ($text in $forbiddenText) {
        if ($content -like "*$text*") {
            Write-Host "FAIL SQL file contains forbidden text '$text': $($file.FullName)"
            exit 1
        }
    }
}

$fkPattern = 'FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\('
foreach ($file in $sqlFiles) {
    $serviceKey = Split-Path -Leaf (Split-Path -Parent $file.FullName)
    $lines = Get-Content -LiteralPath $file.FullName
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match $fkPattern) {
            $referenced = $matches[2].ToLower()
            $owner = $tableOwner[$referenced]
            if (-not $owner) {
                Write-Host "FAIL FK references unowned table '$referenced' in $($file.FullName):$($i + 1)"
                exit 1
            }
            if ($owner -ne $serviceKey) {
                Write-Host "FAIL cross-owner FK in production split SQL: $($file.FullName):$($i + 1) references $referenced owned by $owner"
                exit 1
            }
        }
    }
}

Write-Host "PASS production split SQL safety check"
```

- [ ] **Step 2: 将检查脚本加入一键验收**

在 `scripts/verify-microservice-boundaries.ps1` 的 Local schema SQL safety 步骤后、Java boundary tests 步骤前加入：

```powershell
Invoke-Step -Name "Production split SQL safety" -Command {
    powershell -ExecutionPolicy Bypass -File (Join-Path -Path $repoRoot -ChildPath "scripts/check-production-split-sql.ps1")
}
```

- [ ] **Step 3: 运行检查并确认当前失败**

Run: `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`

Expected: 失败，输出缺少 `sql/production-split/<service>` 目录或 SQL 文件。这是预期红灯，因为 Task 3 还没有创建 SQL 文件。

- [ ] **Step 4: 暂不提交**

不要在此任务提交，因为 `scripts/verify-microservice-boundaries.ps1` 已引用新检查脚本，而 Task 3 尚未创建生产拆库 SQL。提交一个一键验收失败的中间状态会污染主线。保持文件未提交，继续 Task 3。

---

### Task 3: 新增 same-owner constraint SQL

**Files:**
- Create: `sql/production-split/user/001_same_owner_constraints.sql`
- Create: `sql/production-split/ticket/001_same_owner_constraints.sql`
- Create: `sql/production-split/order/001_same_owner_constraints.sql`
- Create: `sql/production-split/payment/001_same_owner_constraints.sql`
- Create: `sql/production-split/notification/001_same_owner_constraints.sql`

- [ ] **Step 1: 创建 user 约束文件**

`sql/production-split/user/001_same_owner_constraints.sql` 内容：

```sql
-- owner: java-user

ALTER TABLE organizer_application
    ADD CONSTRAINT fk_organizer_application_user
    FOREIGN KEY (user_id) REFERENCES "user"(id);

ALTER TABLE organizer_application
    ADD CONSTRAINT fk_organizer_application_reviewer
    FOREIGN KEY (reviewer_id) REFERENCES "user"(id);

ALTER TABLE user_auth
    ADD CONSTRAINT fk_user_auth_user
    FOREIGN KEY (user_id) REFERENCES "user"(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_phone ON "user"(phone);
CREATE INDEX IF NOT EXISTS idx_user_auth_user ON user_auth(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizer_application_user_id ON organizer_application(user_id);
CREATE INDEX IF NOT EXISTS idx_organizer_application_status ON organizer_application(status);
CREATE INDEX IF NOT EXISTS idx_organizer_application_create_time ON organizer_application(create_time DESC);
```

- [ ] **Step 2: 创建 ticket 约束文件**

`sql/production-split/ticket/001_same_owner_constraints.sql` 内容：

```sql
-- owner: java-ticket

ALTER TABLE venue_application ADD CONSTRAINT fk_venue_application_venue FOREIGN KEY (venue_id) REFERENCES venue(id);
ALTER TABLE venue_area ADD CONSTRAINT fk_venue_area_venue FOREIGN KEY (venue_id) REFERENCES venue(id);
ALTER TABLE venue_seat ADD CONSTRAINT fk_venue_seat_venue FOREIGN KEY (venue_id) REFERENCES venue(id);
ALTER TABLE venue_seat ADD CONSTRAINT fk_venue_seat_area FOREIGN KEY (area_id) REFERENCES venue_area(id);
ALTER TABLE activity ADD CONSTRAINT fk_activity_category FOREIGN KEY (category_id) REFERENCES category(id);
ALTER TABLE activity ADD CONSTRAINT fk_activity_artist FOREIGN KEY (artist_id) REFERENCES artist(id);
ALTER TABLE session ADD CONSTRAINT fk_session_activity FOREIGN KEY (activity_id) REFERENCES activity(id);
ALTER TABLE session ADD CONSTRAINT fk_session_venue FOREIGN KEY (venue_id) REFERENCES venue(id);
ALTER TABLE ticket_type ADD CONSTRAINT fk_ticket_type_session FOREIGN KEY (session_id) REFERENCES session(id);
ALTER TABLE reservation ADD CONSTRAINT fk_reservation_session FOREIGN KEY (session_id) REFERENCES session(id);
ALTER TABLE seat ADD CONSTRAINT fk_seat_session FOREIGN KEY (session_id) REFERENCES session(id);
ALTER TABLE seat ADD CONSTRAINT fk_seat_ticket_type FOREIGN KEY (ticket_type_id) REFERENCES ticket_type(id);
ALTER TABLE session_seat ADD CONSTRAINT fk_session_seat_session FOREIGN KEY (session_id) REFERENCES session(id);
ALTER TABLE session_seat ADD CONSTRAINT fk_session_seat_venue FOREIGN KEY (venue_id) REFERENCES venue(id);
ALTER TABLE session_seat ADD CONSTRAINT fk_session_seat_area FOREIGN KEY (area_id) REFERENCES venue_area(id);
ALTER TABLE session_seat ADD CONSTRAINT fk_session_seat_venue_seat FOREIGN KEY (venue_seat_id) REFERENCES venue_seat(id);
ALTER TABLE session_seat ADD CONSTRAINT fk_session_seat_ticket_type FOREIGN KEY (ticket_type_id) REFERENCES ticket_type(id);
ALTER TABLE ticket_type_area ADD CONSTRAINT fk_ticket_type_area_ticket_type FOREIGN KEY (ticket_type_id) REFERENCES ticket_type(id);
ALTER TABLE ticket_type_area ADD CONSTRAINT fk_ticket_type_area_session FOREIGN KEY (session_id) REFERENCES session(id);
ALTER TABLE ticket_type_area ADD CONSTRAINT fk_ticket_type_area_area FOREIGN KEY (area_id) REFERENCES venue_area(id);
ALTER TABLE stock_log ADD CONSTRAINT fk_stock_log_session FOREIGN KEY (session_id) REFERENCES session(id);
ALTER TABLE stock_log ADD CONSTRAINT fk_stock_log_ticket_type FOREIGN KEY (ticket_type_id) REFERENCES ticket_type(id);
ALTER TABLE venue_seat_layout_template ADD CONSTRAINT fk_template_venue FOREIGN KEY (venue_id) REFERENCES venue(id);
ALTER TABLE venue_seat_layout_template_section ADD CONSTRAINT fk_template_section_template FOREIGN KEY (template_id) REFERENCES venue_seat_layout_template(id) ON DELETE CASCADE;
ALTER TABLE venue_default_layout ADD CONSTRAINT fk_venue_default_layout_venue FOREIGN KEY (venue_id) REFERENCES venue(id);
ALTER TABLE venue_default_layout_section ADD CONSTRAINT fk_venue_default_section_layout FOREIGN KEY (default_layout_id) REFERENCES venue_default_layout(id) ON DELETE CASCADE;
ALTER TABLE activity_seat_layout ADD CONSTRAINT fk_activity_layout_activity FOREIGN KEY (activity_id) REFERENCES activity(id) ON DELETE CASCADE;
ALTER TABLE activity_seat_layout ADD CONSTRAINT fk_activity_layout_template FOREIGN KEY (source_template_id) REFERENCES venue_seat_layout_template(id);
ALTER TABLE activity_seat_layout_section ADD CONSTRAINT fk_activity_section_layout FOREIGN KEY (activity_layout_id) REFERENCES activity_seat_layout(id) ON DELETE CASCADE;
ALTER TABLE activity_seat_layout_section ADD CONSTRAINT fk_activity_section_template_section FOREIGN KEY (source_template_section_id) REFERENCES venue_seat_layout_template_section(id);
ALTER TABLE session_seat_layout ADD CONSTRAINT fk_session_layout_session FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE;
ALTER TABLE session_seat_layout ADD CONSTRAINT fk_session_layout_activity_layout FOREIGN KEY (activity_layout_id) REFERENCES activity_seat_layout(id);
ALTER TABLE session_seat_layout ADD CONSTRAINT fk_session_layout_template FOREIGN KEY (source_template_id) REFERENCES venue_seat_layout_template(id);
ALTER TABLE session_seat_layout_section ADD CONSTRAINT fk_session_section_layout FOREIGN KEY (session_layout_id) REFERENCES session_seat_layout(id) ON DELETE CASCADE;
ALTER TABLE session_seat_layout_section ADD CONSTRAINT fk_session_section_activity_section FOREIGN KEY (activity_layout_section_id) REFERENCES activity_seat_layout_section(id);
ALTER TABLE session_seat_layout_section ADD CONSTRAINT fk_session_section_template_section FOREIGN KEY (source_template_section_id) REFERENCES venue_seat_layout_template_section(id);
ALTER TABLE session_seat_layout_section ADD CONSTRAINT fk_session_section_ticket_type FOREIGN KEY (ticket_type_id) REFERENCES ticket_type(id);
ALTER TABLE session_seat ADD CONSTRAINT fk_session_seat_layout_section FOREIGN KEY (layout_section_id) REFERENCES session_seat_layout_section(id);
ALTER TABLE seat_override ADD CONSTRAINT fk_seat_override_block FOREIGN KEY (seat_block_id) REFERENCES seat_block(id);
ALTER TABLE station ADD CONSTRAINT fk_station_tour FOREIGN KEY (tour_id) REFERENCES tour(id);

CREATE INDEX IF NOT EXISTS idx_venue_application_applicant ON venue_application(applicant_id);
CREATE INDEX IF NOT EXISTS idx_venue_application_status ON venue_application(status);
CREATE INDEX IF NOT EXISTS idx_venue_application_create_time ON venue_application(create_time DESC);
CREATE INDEX IF NOT EXISTS idx_venue_area_venue ON venue_area(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_area_status ON venue_area(status);
CREATE INDEX IF NOT EXISTS idx_venue_seat_venue ON venue_seat(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_seat_area ON venue_seat(area_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_seat_area_position ON venue_seat(area_id, row_no, seat_no) WHERE status = 1;
CREATE INDEX IF NOT EXISTS idx_session_seat_session ON session_seat(session_id);
CREATE INDEX IF NOT EXISTS idx_session_seat_venue ON session_seat(venue_id);
CREATE INDEX IF NOT EXISTS idx_session_seat_area ON session_seat(area_id);
CREATE INDEX IF NOT EXISTS idx_session_seat_status ON session_seat(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_seat_session_venue_seat ON session_seat(session_id, venue_seat_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_seat_layout_position ON session_seat(session_id, layout_section_id, row_no, seat_no) WHERE layout_section_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_type_area_ticket_type ON ticket_type_area(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_ticket_type_area_session ON ticket_type_area(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_type_area_session_area_unique ON ticket_type_area(session_id, area_id);
CREATE INDEX IF NOT EXISTS idx_stock_log_session ON stock_log(session_id);
CREATE INDEX IF NOT EXISTS idx_reservation_user ON reservation(user_id);
CREATE INDEX IF NOT EXISTS idx_session_activity ON session(activity_id);
CREATE INDEX IF NOT EXISTS idx_ticket_type_session ON ticket_type(session_id);
CREATE INDEX IF NOT EXISTS idx_seat_session ON seat(session_id);
CREATE INDEX IF NOT EXISTS idx_seat_ticket_type ON seat(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_venue_seat_layout_template_venue ON venue_seat_layout_template(venue_id);
CREATE INDEX IF NOT EXISTS idx_template_section_template ON venue_seat_layout_template_section(template_id);
CREATE INDEX IF NOT EXISTS idx_activity_seat_layout_activity ON activity_seat_layout(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_section_layout ON activity_seat_layout_section(activity_layout_id);
CREATE INDEX IF NOT EXISTS idx_session_seat_layout_session ON session_seat_layout(session_id);
CREATE INDEX IF NOT EXISTS idx_session_section_layout ON session_seat_layout_section(session_layout_id);
CREATE INDEX IF NOT EXISTS idx_session_section_ticket_type ON session_seat_layout_section(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_session_seat_layout_section ON session_seat(layout_section_id);
```

- [ ] **Step 3: 创建 order 约束文件**

`sql/production-split/order/001_same_owner_constraints.sql` 内容：

```sql
-- owner: java-order

ALTER TABLE order_seat
    ADD CONSTRAINT fk_order_seat_order
    FOREIGN KEY (order_id) REFERENCES "order"(id);

ALTER TABLE order_snapshot
    ADD CONSTRAINT fk_order_snapshot_order
    FOREIGN KEY (order_id) REFERENCES "order"(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_order_user ON "order"(user_id);
CREATE INDEX IF NOT EXISTS idx_order_no ON "order"(order_no);
CREATE INDEX IF NOT EXISTS idx_order_status ON "order"(status);
CREATE INDEX IF NOT EXISTS idx_order_seat_order ON order_seat(order_id);
CREATE INDEX IF NOT EXISTS idx_order_seat_session_seat ON order_seat(session_seat_id);
CREATE INDEX IF NOT EXISTS idx_order_seat_status ON order_seat(status);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_order_id ON order_snapshot(order_id);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_activity_id ON order_snapshot(activity_id);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_session_id ON order_snapshot(session_id);
```

- [ ] **Step 4: 创建 payment 约束文件**

`sql/production-split/payment/001_same_owner_constraints.sql` 内容：

```sql
-- owner: java-payment

ALTER TABLE refund_request
    ADD CONSTRAINT fk_refund_request_payment
    FOREIGN KEY (payment_id) REFERENCES payment(id);

CREATE INDEX IF NOT EXISTS idx_payment_order ON payment(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_no ON payment(payment_no);
CREATE INDEX IF NOT EXISTS idx_payment_out_trade_no ON payment(out_trade_no);
CREATE INDEX IF NOT EXISTS idx_payment_trade_no ON payment(trade_no);
CREATE INDEX IF NOT EXISTS idx_refund_order ON refund_request(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_order_active_unique ON refund_request(order_id) WHERE status IN (0, 1, 4);
CREATE INDEX IF NOT EXISTS idx_refund_user ON refund_request(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_status ON refund_request(status);
CREATE INDEX IF NOT EXISTS idx_refund_no ON refund_request(refund_no);
```

- [ ] **Step 5: 创建 notification 约束文件**

`sql/production-split/notification/001_same_owner_constraints.sql` 内容：

```sql
-- owner: java-notification

CREATE INDEX IF NOT EXISTS idx_notification_user ON notification(user_id);
```

- [ ] **Step 6: 运行生产 SQL 检查**

Run: `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`

Expected: `PASS production split SQL safety check`。

- [ ] **Step 7: Commit**

```powershell
git add scripts/check-production-split-sql.ps1 scripts/verify-microservice-boundaries.ps1 sql/production-split/user sql/production-split/ticket sql/production-split/order sql/production-split/payment sql/production-split/notification
git commit -m "chore: add production split sql guardrails"
```

---

### Task 4: 新增导出脚本

**Files:**
- Create: `scripts/export-production-split.ps1`

- [ ] **Step 1: 创建导出脚本**

写入以下完整内容：

```powershell
param(
    [string]$SourceHost = "localhost",
    [int]$SourcePort = 5432,
    [string]$SourceDatabase = "omni_ticket",
    [string]$SourceUser = "postgres",
    [string]$OutputDir = "artifacts/production-split"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestFile = Join-Path -Path $repoRoot -ChildPath "sql/production-split/manifest.json"
$manifest = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
$fullOutputDir = Join-Path -Path $repoRoot -ChildPath $OutputDir

New-Item -ItemType Directory -Path $fullOutputDir -Force | Out-Null

foreach ($service in $manifest.services) {
    $serviceDir = Join-Path -Path $fullOutputDir -ChildPath $service.key
    New-Item -ItemType Directory -Path $serviceDir -Force | Out-Null

    $schemaFile = Join-Path -Path $serviceDir -ChildPath "001_pre_data.sql"
    $dataFile = Join-Path -Path $serviceDir -ChildPath "002_data.sql"

    $tableArgs = @()
    foreach ($table in $service.tables) {
        $tableArgs += "--table=public.$table"
    }

    Write-Host "Export schema for $($service.service) -> $schemaFile"
    & pg_dump -h $SourceHost -p $SourcePort -U $SourceUser -d $SourceDatabase --schema=public --section=pre-data --no-owner --no-privileges @tableArgs -f $schemaFile
    if ($LASTEXITCODE -ne 0) { throw "pg_dump schema failed for $($service.service)" }

    Write-Host "Export data for $($service.service) -> $dataFile"
    & pg_dump -h $SourceHost -p $SourcePort -U $SourceUser -d $SourceDatabase --schema=public --data-only --column-inserts --disable-triggers --no-owner --no-privileges @tableArgs -f $dataFile
    if ($LASTEXITCODE -ne 0) { throw "pg_dump data failed for $($service.service)" }
}

Write-Host "PASS production split export artifacts written to $fullOutputDir"
```

- [ ] **Step 2: 验证脚本语法**

Run: `powershell -NoProfile -Command "$null = [scriptblock]::Create((Get-Content -Raw -LiteralPath 'scripts/export-production-split.ps1')); 'syntax ok'"`

Expected: 输出 `syntax ok`。

- [ ] **Step 3: 在本地库执行一次导出预演**

Run: `$env:PGPASSWORD='123456'; powershell -ExecutionPolicy Bypass -File scripts/export-production-split.ps1 -SourceHost localhost -SourcePort 5432 -SourceDatabase omni_ticket -SourceUser postgres -OutputDir artifacts/production-split-local`

Expected: 每个服务目录下生成 `001_pre_data.sql` 和 `002_data.sql`，最后输出 `PASS production split export artifacts written to ...`。

- [ ] **Step 4: Commit**

```powershell
git add scripts/export-production-split.ps1
git commit -m "chore: add production split export script"
```

---

### Task 5: 新增导入脚本

**Files:**
- Create: `scripts/import-production-split.ps1`

- [ ] **Step 1: 创建导入脚本**

写入以下完整内容：

```powershell
param(
    [Parameter(Mandatory = $true)][string]$ArtifactDir,
    [Parameter(Mandatory = $true)][string]$UserHost,
    [Parameter(Mandatory = $true)][string]$TicketHost,
    [Parameter(Mandatory = $true)][string]$OrderHost,
    [Parameter(Mandatory = $true)][string]$PaymentHost,
    [Parameter(Mandatory = $true)][string]$NotificationHost,
    [int]$Port = 5432,
    [string]$DbUser = "postgres"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestFile = Join-Path -Path $repoRoot -ChildPath "sql/production-split/manifest.json"
$manifest = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
$hostByKey = @{
    user = $UserHost
    ticket = $TicketHost
    order = $OrderHost
    payment = $PaymentHost
    notification = $NotificationHost
}

foreach ($service in $manifest.services) {
    $hostName = $hostByKey[$service.key]
    $dbName = $service.targetDatabase
    $serviceArtifactDir = Join-Path -Path $ArtifactDir -ChildPath $service.key
    $preDataFile = Join-Path -Path $serviceArtifactDir -ChildPath "001_pre_data.sql"
    $dataFile = Join-Path -Path $serviceArtifactDir -ChildPath "002_data.sql"
    $sameOwnerFile = Join-Path -Path $repoRoot -ChildPath "sql/production-split/$($service.key)/001_same_owner_constraints.sql"

    foreach ($file in @($preDataFile, $dataFile, $sameOwnerFile)) {
        if (-not (Test-Path -LiteralPath $file)) {
            throw "Missing import file for $($service.service): $file"
        }
    }

    Write-Host "Import $($service.service) schema into $hostName/$dbName"
    & psql -h $hostName -p $Port -U $DbUser -d $dbName -v ON_ERROR_STOP=1 -f $preDataFile
    if ($LASTEXITCODE -ne 0) { throw "pre-data import failed for $($service.service)" }

    Write-Host "Import $($service.service) data into $hostName/$dbName"
    & psql -h $hostName -p $Port -U $DbUser -d $dbName -v ON_ERROR_STOP=1 -f $dataFile
    if ($LASTEXITCODE -ne 0) { throw "data import failed for $($service.service)" }

    Write-Host "Apply $($service.service) same-owner constraints"
    & psql -h $hostName -p $Port -U $DbUser -d $dbName -v ON_ERROR_STOP=1 -f $sameOwnerFile
    if ($LASTEXITCODE -ne 0) { throw "same-owner constraints failed for $($service.service)" }
}

Write-Host "PASS production split import completed"
```

- [ ] **Step 2: 验证脚本语法**

Run: `powershell -NoProfile -Command "$null = [scriptblock]::Create((Get-Content -Raw -LiteralPath 'scripts/import-production-split.ps1')); 'syntax ok'"`

Expected: 输出 `syntax ok`。

- [ ] **Step 3: Commit**

```powershell
git add scripts/import-production-split.ps1
git commit -m "chore: add production split import script"
```

---

### Task 6: 新增 prod-split Spring profile

**Files:**
- Create: `java/java-user/src/main/resources/application-prod-split.yml`
- Create: `java/java-ticket/src/main/resources/application-prod-split.yml`
- Create: `java/java-order/src/main/resources/application-prod-split.yml`
- Create: `java/java-payment/src/main/resources/application-prod-split.yml`
- Create: `java/java-notification/src/main/resources/application-prod-split.yml`

- [ ] **Step 1: 为五个业务服务创建 profile 文件**

每个文件写入以下相同内容：

```yaml
spring:
  datasource:
    url: ${SPRING_DATASOURCE_URL}
    username: ${SPRING_DATASOURCE_USERNAME}
    password: ${SPRING_DATASOURCE_PASSWORD}
```

- [ ] **Step 2: 验证资源文件存在**

Run: `powershell -NoProfile -Command "@('java-user','java-ticket','java-order','java-payment','java-notification') | ForEach-Object { $p = \"java/$_/src/main/resources/application-prod-split.yml\"; if (-not (Test-Path $p)) { throw \"missing $p\" } }; 'prod-split profiles ok'"`

Expected: 输出 `prod-split profiles ok`。

- [ ] **Step 3: 编译资源加载相关模块**

Run from `java/`: `mvn test -pl java-user,java-ticket,java-order,java-payment,java-notification -am --% -Dsurefire.failIfNoSpecifiedTests=false`

Expected: Maven `BUILD SUCCESS`。

- [ ] **Step 4: Commit**

```powershell
git add java/java-user/src/main/resources/application-prod-split.yml java/java-ticket/src/main/resources/application-prod-split.yml java/java-order/src/main/resources/application-prod-split.yml java/java-payment/src/main/resources/application-prod-split.yml java/java-notification/src/main/resources/application-prod-split.yml
git commit -m "chore: add production split datasource profiles"
```

---

### Task 7: 新增迁移后运行态验证脚本

**Files:**
- Create: `scripts/verify-production-split-runtime.ps1`

- [ ] **Step 1: 创建验证脚本**

写入以下完整内容：

```powershell
param(
    [Parameter(Mandatory = $true)][string]$UserHost,
    [Parameter(Mandatory = $true)][string]$TicketHost,
    [Parameter(Mandatory = $true)][string]$OrderHost,
    [Parameter(Mandatory = $true)][string]$PaymentHost,
    [Parameter(Mandatory = $true)][string]$NotificationHost,
    [int]$Port = 5432,
    [string]$DbUser = "postgres"
)

$ErrorActionPreference = "Stop"
$checks = @(
    @{ Key = "user"; Host = $UserHost; Database = "omni_user" },
    @{ Key = "ticket"; Host = $TicketHost; Database = "omni_ticket" },
    @{ Key = "order"; Host = $OrderHost; Database = "omni_order" },
    @{ Key = "payment"; Host = $PaymentHost; Database = "omni_payment" },
    @{ Key = "notification"; Host = $NotificationHost; Database = "omni_notification" }
)

$crossOwnerQuery = @"
SELECT conrelid::regclass::text AS child_table, confrelid::regclass::text AS ref_table, conname
FROM pg_constraint
WHERE contype = 'f'
  AND (
    conrelid::regclass::text IN ('"order"','order_seat','payment','refund_request','notification','activity','venue_application','stock_log','session_seat')
    OR confrelid::regclass::text IN ('"user"','"order"','session','ticket_type','session_seat')
  )
ORDER BY child_table, ref_table, conname;
"@

foreach ($check in $checks) {
    Write-Host "Check database connection: $($check.Key) $($check.Host)/$($check.Database)"
    & psql -h $check.Host -p $Port -U $DbUser -d $check.Database -v ON_ERROR_STOP=1 -c "SELECT current_database();"
    if ($LASTEXITCODE -ne 0) { throw "database connection failed for $($check.Key)" }

    Write-Host "Inspect FK inventory: $($check.Key)"
    $fkOutput = & psql -h $check.Host -p $Port -U $DbUser -d $check.Database -t -A -c $crossOwnerQuery
    if ($LASTEXITCODE -ne 0) { throw "FK inspection failed for $($check.Key)" }
    if (($fkOutput | Where-Object { $_.Trim().Length -gt 0 }).Count -gt 0) {
        throw "unexpected FK output for $($check.Key): $fkOutput"
    }
}

Write-Host "PASS production split runtime database checks"
```

- [ ] **Step 2: 验证脚本语法**

Run: `powershell -NoProfile -Command "$null = [scriptblock]::Create((Get-Content -Raw -LiteralPath 'scripts/verify-production-split-runtime.ps1')); 'syntax ok'"`

Expected: 输出 `syntax ok`。

- [ ] **Step 3: Commit**

```powershell
git add scripts/verify-production-split-runtime.ps1
git commit -m "chore: add production split runtime verifier"
```

---

### Task 8: 新增 cutover checklist 文档

**Files:**
- Create: `docs/operations/production-db-split-cutover-checklist.md`

- [ ] **Step 1: 创建 checklist**

写入以下完整内容：

```markdown
# 生产物理拆库 Cutover Checklist

## 前置确认

- [ ] 已完成 staging 预演。
- [ ] `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1` 通过。
- [ ] `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1` 通过。
- [ ] 已确认 `sql/local/*` 未进入生产迁移链路。
- [ ] 已确认五个目标 PostgreSQL 实例可连接。
- [ ] 已准备原共享库完整备份目录。
- [ ] 已确认维护窗口内不会开放写入流量。

## 停机和备份

- [ ] 公告维护开始。
- [ ] 阻断前端和网关外部流量。
- [ ] 停止 `java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification`。
- [ ] 对原共享库执行完整备份。
- [ ] 在非生产库验证备份可恢复。

## 导出和导入

- [ ] 执行 `scripts/export-production-split.ps1` 生成 artifact。
- [ ] 人工确认五个服务 artifact 均包含 `001_pre_data.sql` 和 `002_data.sql`。
- [ ] 执行 `scripts/import-production-split.ps1` 导入五个目标数据库。
- [ ] 执行 `scripts/verify-production-split-runtime.ps1`。
- [ ] 对比迁移表行数。
- [ ] 检查 sequence 当前值不小于主键最大值。
- [ ] 检查目标库不存在 cross-owner FK。

## 配置和启动

- [ ] 设置五个服务的 `SPRING_PROFILES_ACTIVE=prod-split`。
- [ ] 设置五个服务各自的 `SPRING_DATASOURCE_URL`。
- [ ] 设置五个服务各自的 `SPRING_DATASOURCE_USERNAME`。
- [ ] 设置五个服务各自的 `SPRING_DATASOURCE_PASSWORD`。
- [ ] 设置统一的 `OMNI_INTERNAL_TOKEN`。
- [ ] 启动五个业务服务。
- [ ] 确认没有服务连接旧共享库。

## 业务冒烟

- [ ] 用户登录成功。
- [ ] 活动列表和活动详情成功。
- [ ] 场次和票档查询成功。
- [ ] 创建订单成功。
- [ ] 支付二维码或页面支付创建成功。
- [ ] 支付同步后订单变为已支付。
- [ ] 订单详情和订单列表成功。
- [ ] 通知发送和通知列表成功。
- [ ] 管理端活动管理可加载。
- [ ] 管理端场次管理可加载。
- [ ] 管理端订单查看可加载。

## 开放流量

- [ ] 负责人确认所有检查通过。
- [ ] 重新开放网关和前端流量。
- [ ] 观察服务日志和数据库连接 15 分钟。

## 回滚

- [ ] 如果开放流量前失败，停止拆分库服务。
- [ ] 恢复旧 datasource 配置。
- [ ] 重新启动服务连接原共享库。
- [ ] 验证登录、票务浏览、订单列表和管理端。
- [ ] 如果开放流量后失败，先停止写入流量，再决定人工对账或前滚修复。
```

- [ ] **Step 2: Commit**

```powershell
git add docs/operations/production-db-split-cutover-checklist.md
git commit -m "docs: add production split cutover checklist"
```

---

### Task 9: 更新项目文档

**Files:**
- Modify: `docs/microservices/service-boundaries.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 更新 service-boundaries**

在 `docs/microservices/service-boundaries.md` 的 `Production Migration Safety Gate` 后追加：

```markdown

## Production Physical Split Assets

生产物理拆库实施资产位于：

- `docs/superpowers/specs/2026-05-20-production-physical-db-split-design.md`
- `docs/superpowers/plans/2026-05-20-production-physical-db-split-implementation.md`
- `sql/production-split/manifest.json`
- `sql/production-split/*/001_same_owner_constraints.sql`
- `scripts/check-production-split-sql.ps1`
- `scripts/export-production-split.ps1`
- `scripts/import-production-split.ps1`
- `scripts/verify-production-split-runtime.ps1`
- `docs/operations/production-db-split-cutover-checklist.md`

生产拆库 SQL 禁止复用 `sql/local/*`。五个业务服务切换时必须统一使用 `prod-split` profile 或统一使用等价环境变量配置，禁止共享库和拆分库混用。
```

- [ ] **Step 2: 更新 CLAUDE.md**

在 `CLAUDE.md` 的微服务边界验收段落后追加：

```markdown

### 生产物理拆库

- 目标拓扑：五个业务服务分别连接五个独立 PostgreSQL 实例。
- 已批准设计：`docs/superpowers/specs/2026-05-20-production-physical-db-split-design.md`。
- 实施计划：`docs/superpowers/plans/2026-05-20-production-physical-db-split-implementation.md`。
- 生产拆库 SQL 只能放在 `sql/production-split/`，禁止使用 `sql/local/*`。
- 生产拆库配置优先使用 `SPRING_PROFILES_ACTIVE=prod-split` 加 `SPRING_DATASOURCE_URL`、`SPRING_DATASOURCE_USERNAME`、`SPRING_DATASOURCE_PASSWORD`。
- 切换期间五个业务服务必须统一连接拆分库，禁止部分服务继续写共享库。
- 开放流量前必须通过 cutover checklist 和 `scripts/verify-production-split-runtime.ps1`。
```

- [ ] **Step 3: Commit**

```powershell
git add docs/microservices/service-boundaries.md CLAUDE.md
git commit -m "docs: document production split operations"
```

---

### Task 10: 完整验证

**Files:**
- No code changes.

- [ ] **Step 1: 运行生产拆库 SQL 检查**

Run: `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`

Expected: `PASS production split SQL safety check`。

- [ ] **Step 2: 运行一键边界验收**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`

Expected: `All microservice boundary checks passed.`。

- [ ] **Step 3: 运行 Java 边界测试**

Run from `java/`: `mvn test -pl java-user,java-ticket,java-order,java-payment,java-notification -am --% -Dsurefire.failIfNoSpecifiedTests=false`

Expected: Maven `BUILD SUCCESS`。

- [ ] **Step 4: 本地导出预演**

Run: `$env:PGPASSWORD='123456'; powershell -ExecutionPolicy Bypass -File scripts/export-production-split.ps1 -SourceHost localhost -SourcePort 5432 -SourceDatabase omni_ticket -SourceUser postgres -OutputDir artifacts/production-split-local`

Expected: `artifacts/production-split-local/user`、`ticket`、`order`、`payment`、`notification` 均包含 `001_pre_data.sql` 和 `002_data.sql`。

- [ ] **Step 5: 检查 artifact 未被提交**

Run: `git status --short`

Expected: `artifacts/production-split-local` 不应被 staged。若显示为 untracked，保持不提交。

- [ ] **Step 6: 最终 Commit**

```powershell
git add docs/superpowers/plans/2026-05-20-production-physical-db-split-implementation.md
git commit -m "docs: add production split implementation plan"
```

---

## 实施完成标准

- `scripts/check-production-split-sql.ps1` 通过。
- `scripts/verify-microservice-boundaries.ps1` 通过。
- 五个业务服务均存在 `application-prod-split.yml`。
- `sql/production-split/manifest.json` 覆盖设计中的全部服务表归属。
- `sql/production-split/*/001_same_owner_constraints.sql` 不包含 cross-owner FK。
- 导出脚本可从本地共享库生成五个服务 artifact。
- cutover checklist 明确停机、备份、导出、导入、验证、开放流量和回滚步骤。
- 没有把 `artifacts/`、备份文件或生产敏感连接信息提交到 git。
