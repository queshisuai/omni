# Grab Request ID and JMeter Load Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate grab request `request_id` collisions under high concurrency and add a reusable JMeter plan for 1000 concurrent requests competing for 100 Redis stock units.

**Architecture:** Replace timestamp-plus-random request IDs with cryptographically random IDs generated inside `GrabService`, preserving the `GRAB` prefix and existing API response shape. Add focused unit coverage for request ID uniqueness and a JMeter `.jmx` that drives the real `POST /api/grab/requests` API with CSV-fed users/tokens/idempotency keys.

**Tech Stack:** NestJS 10, TypeScript, Node `crypto`, Jest, PostgreSQL, Redis, Apache JMeter.

---

## File Structure

- Modify `nestjs/grab-service/src/grab/grab.service.ts`
  - Responsibility: generate collision-resistant request IDs for new grab requests.
- Modify `nestjs/grab-service/src/grab/grab.service.spec.ts`
  - Responsibility: cover request ID uniqueness and existing submit behavior.
- Create `nestjs/grab-service/jmeter/grab-1000-users.csv`
  - Responsibility: sample CSV schema for JMeter variables; generated rows can be replaced before a run.
- Create `nestjs/grab-service/jmeter/grab-1000-concurrent-100-stock.jmx`
  - Responsibility: reusable JMeter test plan for 1000 concurrent grab submissions.
- No changes to `start-project.ps1`
  - Existing project start script already keeps Nacos discovery enabled and pins discovery IP to `127.0.0.1`; the earlier failure came from a one-off manual `--spring.cloud.nacos.discovery.enabled=false` startup.

---

### Task 1: Make request IDs collision-resistant

**Files:**
- Modify: `nestjs/grab-service/src/grab/grab.service.ts`
- Test: `nestjs/grab-service/src/grab/grab.service.spec.ts`

- [ ] **Step 1: Write the failing uniqueness test**

Add this import at the top of `nestjs/grab-service/src/grab/grab.service.spec.ts` if it is not already present:

```ts
import { GrabService } from './grab.service';
```

Add this test inside the existing `describe('GrabService', ...)` block. It intentionally reaches the private method via bracket access because the bug is isolated to ID generation and the public path would require 1000 mocked order/admission/database interactions.

```ts
  it('generates unique request ids under high concurrency volume', () => {
    const service = new GrabService({} as any, {} as any, {} as any);
    const ids = Array.from({ length: 5000 }, () => service['generateRequestId']());

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^GRAB[0-9a-f]{24}$/.test(id))).toBe(true);
  });
```

- [ ] **Step 2: Run the focused test to verify it fails on the current implementation**

Run from `nestjs/grab-service`:

```bash
npm test -- --runTestsByPath src/grab/grab.service.spec.ts --runInBand
```

Expected before implementation: FAIL because current IDs match `GRAB\d{20}` rather than `GRAB[0-9a-f]{24}`; collisions may also appear under enough same-second volume.

- [ ] **Step 3: Implement the minimal request ID change**

Modify `nestjs/grab-service/src/grab/grab.service.ts`.

Add this import at the top:

```ts
import { randomBytes } from 'crypto';
```

Replace the existing `generateRequestId()` implementation:

```ts
  private generateRequestId(): string {
    return `GRAB${randomBytes(12).toString('hex')}`;
  }
```

The final import block should look like this:

```ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { GrabAdmissionService } from './grab-admission.service';
import { GrabRepository, isUniqueViolation } from './grab.repository';
import { GRAB_STATUS } from './grab-status';
import type { GrabRequestRecord, GrabRequestResponse, SubmitGrabRequestDto } from './grab.types';
import { OrderClientService } from './order-client.service';
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run from `nestjs/grab-service`:

```bash
npm test -- --runTestsByPath src/grab/grab.service.spec.ts --runInBand
```

Expected after implementation: PASS for the uniqueness test and existing `GrabService` tests.

- [ ] **Step 5: Build the grab-service runtime artifact**

Run from `nestjs/grab-service`:

```bash
npm run build
```

Expected: command exits 0 and `dist/grab/grab.service.js` contains the new `crypto.randomBytes` request ID generation.

---

### Task 2: Add reusable JMeter assets

**Files:**
- Create: `nestjs/grab-service/jmeter/grab-1000-users.csv`
- Create: `nestjs/grab-service/jmeter/grab-1000-concurrent-100-stock.jmx`

- [ ] **Step 1: Create the JMeter CSV template**

Create `nestjs/grab-service/jmeter/grab-1000-users.csv` with these header and sample rows:

```csv
userId,phone,jwt,idempotencyKey
300001,17000000001,REPLACE_WITH_JWT_FOR_USER_300001,load-1000-100-1
300002,17000000002,REPLACE_WITH_JWT_FOR_USER_300002,load-1000-100-2
300003,17000000003,REPLACE_WITH_JWT_FOR_USER_300003,load-1000-100-3
```

Before a real 1000-user run, generate 1000 rows with valid JWTs signed by `JWT_SECRET=omni-jwt-secret`. The `.jmx` reads one row per virtual user.

- [ ] **Step 2: Create the JMeter test plan**

Create `nestjs/grab-service/jmeter/grab-1000-concurrent-100-stock.jmx` with this content:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Grab 1000 Concurrent Users For 100 Stock" enabled="true">
      <stringProp name="TestPlan.comments">POST /api/grab/requests with 1000 concurrent users competing for 100 Redis stock units.</stringProp>
      <boolProp name="TestPlan.functional_mode">false</boolProp>
      <boolProp name="TestPlan.tearDown_on_shutdown">true</boolProp>
      <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments" guiclass="ArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">
        <collectionProp name="Arguments.arguments">
          <elementProp name="host" elementType="Argument">
            <stringProp name="Argument.name">host</stringProp>
            <stringProp name="Argument.value">localhost</stringProp>
            <stringProp name="Argument.metadata">=</stringProp>
          </elementProp>
          <elementProp name="port" elementType="Argument">
            <stringProp name="Argument.name">port</stringProp>
            <stringProp name="Argument.value">3002</stringProp>
            <stringProp name="Argument.metadata">=</stringProp>
          </elementProp>
          <elementProp name="sessionId" elementType="Argument">
            <stringProp name="Argument.name">sessionId</stringProp>
            <stringProp name="Argument.value">1</stringProp>
            <stringProp name="Argument.metadata">=</stringProp>
          </elementProp>
          <elementProp name="ticketTypeId" elementType="Argument">
            <stringProp name="Argument.name">ticketTypeId</stringProp>
            <stringProp name="Argument.value">3</stringProp>
            <stringProp name="Argument.metadata">=</stringProp>
          </elementProp>
          <elementProp name="quantity" elementType="Argument">
            <stringProp name="Argument.name">quantity</stringProp>
            <stringProp name="Argument.value">1</stringProp>
            <stringProp name="Argument.metadata">=</stringProp>
          </elementProp>
        </collectionProp>
      </elementProp>
    </TestPlan>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="1000 concurrent grab users" enabled="true">
        <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" testname="Loop Controller" enabled="true">
          <boolProp name="LoopController.continue_forever">false</boolProp>
          <stringProp name="LoopController.loops">1</stringProp>
        </elementProp>
        <stringProp name="ThreadGroup.num_threads">1000</stringProp>
        <stringProp name="ThreadGroup.ramp_time">1</stringProp>
        <boolProp name="ThreadGroup.scheduler">false</boolProp>
        <stringProp name="ThreadGroup.duration"></stringProp>
        <stringProp name="ThreadGroup.delay"></stringProp>
        <boolProp name="ThreadGroup.same_user_on_next_iteration">true</boolProp>
      </ThreadGroup>
      <hashTree>
        <CSVDataSet guiclass="TestBeanGUI" testclass="CSVDataSet" testname="JWT users CSV" enabled="true">
          <stringProp name="delimiter">,</stringProp>
          <stringProp name="fileEncoding">UTF-8</stringProp>
          <stringProp name="filename">grab-1000-users.csv</stringProp>
          <boolProp name="ignoreFirstLine">true</boolProp>
          <boolProp name="quotedData">false</boolProp>
          <boolProp name="recycle">false</boolProp>
          <stringProp name="shareMode">shareMode.all</stringProp>
          <boolProp name="stopThread">true</boolProp>
          <stringProp name="variableNames">userId,phone,jwt,idempotencyKey</stringProp>
        </CSVDataSet>
        <hashTree/>
        <HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="HTTP Headers" enabled="true">
          <collectionProp name="HeaderManager.headers">
            <elementProp name="" elementType="Header">
              <stringProp name="Header.name">Content-Type</stringProp>
              <stringProp name="Header.value">application/json</stringProp>
            </elementProp>
            <elementProp name="" elementType="Header">
              <stringProp name="Header.name">Authorization</stringProp>
              <stringProp name="Header.value">Bearer ${jwt}</stringProp>
            </elementProp>
          </collectionProp>
        </HeaderManager>
        <hashTree/>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="POST /api/grab/requests" enabled="true">
          <stringProp name="HTTPSampler.domain">${host}</stringProp>
          <stringProp name="HTTPSampler.port">${port}</stringProp>
          <stringProp name="HTTPSampler.protocol">http</stringProp>
          <stringProp name="HTTPSampler.path">/api/grab/requests</stringProp>
          <stringProp name="HTTPSampler.method">POST</stringProp>
          <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
          <boolProp name="HTTPSampler.auto_redirects">false</boolProp>
          <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
          <boolProp name="HTTPSampler.DO_MULTIPART_POST">false</boolProp>
          <boolProp name="HTTPSampler.postBodyRaw">true</boolProp>
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments">
              <elementProp name="" elementType="HTTPArgument">
                <boolProp name="HTTPArgument.always_encode">false</boolProp>
                <stringProp name="Argument.value">{&quot;sessionId&quot;:${sessionId},&quot;ticketTypeId&quot;:${ticketTypeId},&quot;quantity&quot;:${quantity},&quot;idempotencyKey&quot;:&quot;${idempotencyKey}&quot;}</stringProp>
                <stringProp name="Argument.metadata">=</stringProp>
              </elementProp>
            </collectionProp>
          </elementProp>
        </HTTPSamplerProxy>
        <hashTree>
          <ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="HTTP is 201 or business success" enabled="true">
            <collectionProp name="Asserion.test_strings">
              <stringProp name="201">201</stringProp>
            </collectionProp>
            <stringProp name="Assertion.custom_message">Expected Nest POST response HTTP 201</stringProp>
            <stringProp name="Assertion.test_field">Assertion.response_code</stringProp>
            <boolProp name="Assertion.assume_success">false</boolProp>
            <intProp name="Assertion.test_type">8</intProp>
          </ResponseAssertion>
          <hashTree/>
        </hashTree>
        <ResultCollector guiclass="SummaryReport" testclass="ResultCollector" testname="Summary Report" enabled="true">
          <boolProp name="ResultCollector.error_logging">false</boolProp>
          <objProp>
            <name>saveConfig</name>
            <value class="SampleSaveConfiguration">
              <time>true</time>
              <latency>true</latency>
              <timestamp>true</timestamp>
              <success>true</success>
              <label>true</label>
              <code>true</code>
              <message>true</message>
              <threadName>true</threadName>
              <dataType>true</dataType>
              <encoding>false</encoding>
              <assertions>true</assertions>
              <subresults>true</subresults>
              <responseData>false</responseData>
              <samplerData>false</samplerData>
              <xml>false</xml>
              <fieldNames>true</fieldNames>
              <responseHeaders>false</responseHeaders>
              <requestHeaders>false</requestHeaders>
              <responseDataOnError>true</responseDataOnError>
              <saveAssertionResultsFailureMessage>true</saveAssertionResultsFailureMessage>
              <assertionsResultsToSave>0</assertionsResultsToSave>
              <bytes>true</bytes>
              <sentBytes>true</sentBytes>
              <url>true</url>
              <threadCounts>true</threadCounts>
              <idleTime>true</idleTime>
              <connectTime>true</connectTime>
            </value>
          </objProp>
          <stringProp name="filename">grab-1000-concurrent-100-stock-results.jtl</stringProp>
        </ResultCollector>
        <hashTree/>
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>
```

- [ ] **Step 3: Generate a full 1000-row CSV before manual JMeter verification**

Run from `nestjs/grab-service` to overwrite the sample CSV with 1000 valid rows:

```bash
node - <<'NODE'
const fs = require('fs');
const jwt = require('jsonwebtoken');
const rows = ['userId,phone,jwt,idempotencyKey'];
for (let i = 1; i <= 1000; i++) {
  const userId = 300000 + i;
  const phone = '17' + String(i).padStart(9, '0');
  const token = jwt.sign({ userId, phone, role: 'user' }, 'omni-jwt-secret', { expiresIn: '30m' });
  rows.push(`${userId},${phone},${token},jmeter-1000-100-${Date.now()}-${i}`);
}
fs.writeFileSync('jmeter/grab-1000-users.csv', rows.join('\n') + '\n');
NODE
```

Expected: `jmeter/grab-1000-users.csv` has 1001 lines including the header.

- [ ] **Step 4: Prepare runtime data for JMeter**

Run from `nestjs/grab-service`:

```bash
PGPASSWORD=123456 psql -h localhost -p 5432 -U postgres -d omni_user -v ON_ERROR_STOP=1 -c "insert into \"user\" (id, phone, password, nickname, status, role, organizer_status) select 300000 + gs, '17' || lpad(gs::text, 9, '0'), 'loadtest', 'loadtest-' || gs, 1, 'user', 0 from generate_series(1,1000) gs on conflict (id) do update set status=1, role='user', phone=excluded.phone;"
node - <<'NODE'
const Redis = require('ioredis');
const r = new Redis({ host: 'localhost', port: 6379 });
(async () => {
  const keys = ['grab:stock:1:3'];
  for (let i = 1; i <= 1000; i++) {
    keys.push(`grab:user-hold:${300000 + i}:1:3`);
  }
  for (let i = 0; i < keys.length; i += 500) await r.del(...keys.slice(i, i + 500));
  await r.set('grab:stock:1:3', '100');
  console.log('redis_stock_prepared=' + await r.get('grab:stock:1:3'));
  r.disconnect();
})();
NODE
```

Expected:

```text
INSERT 0 1000
redis_stock_prepared=100
```

---

### Task 3: Runtime verification

**Files:**
- No code files modified in this task.
- Uses: `nestjs/grab-service/jmeter/grab-1000-concurrent-100-stock.jmx`

- [ ] **Step 1: Restart grab-service after build**

Stop the old 3002 process, then run from `nestjs/grab-service`:

```bash
JWT_SECRET=omni-jwt-secret INTERNAL_API_TOKEN=omni-local-internal-token ORDER_SERVICE_URL=http://localhost:18083 GRAB_DB_HOST=localhost GRAB_DB_PORT=5432 GRAB_DB_NAME=omni_grab GRAB_DB_USER=postgres GRAB_DB_PASSWORD=123456 REDIS_HOST=localhost REDIS_PORT=6379 GRAB_SERVICE_PORT=3002 npm run start:prod
```

Expected startup evidence:

```text
Grab service running on http://localhost:3002
```

- [ ] **Step 2: Verify Redis stock missing still does not create an order**

Run the same runtime check used during the failure investigation:

```bash
TOKEN=$(node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({userId:2004, phone:'13900000001', role:'user'}, 'omni-jwt-secret', {expiresIn:'10m'}));")
BEFORE=$(PGPASSWORD=123456 psql -h localhost -p 5432 -U postgres -d omni_order -t -A -c "select count(*) from \"order\" where user_id=2004 and session_id=1 and ticket_type_id=3;")
node - <<'NODE'
const Redis=require('ioredis');
const r=new Redis({host:'localhost',port:6379});
r.del('grab:stock:1:3','grab:user-hold:2004:1:3').then(v=>{console.log('redis_deleted='+v); r.disconnect();});
NODE
IDEM=verify-missing-stock-$(date +%s%N)
RESP=$(curl -s -m 20 -X POST http://localhost:3002/api/grab/requests -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"sessionId\":1,\"ticketTypeId\":3,\"quantity\":1,\"idempotencyKey\":\"$IDEM\"}")
AFTER=$(PGPASSWORD=123456 psql -h localhost -p 5432 -U postgres -d omni_order -t -A -c "select count(*) from \"order\" where user_id=2004 and session_id=1 and ticket_type_id=3;")
echo "response=$RESP"
echo "order_count_before=$BEFORE"
echo "order_count_after=$AFTER"
```

Expected: response status `FAILED`, failReason `抢票库存未初始化`, and before/after order counts equal.

- [ ] **Step 3: Verify normal grab creates an order**

Run:

```bash
TOKEN=$(node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({userId:2004, phone:'13900000001', role:'user'}, 'omni-jwt-secret', {expiresIn:'10m'}));")
node - <<'NODE'
const Redis=require('ioredis');
const r=new Redis({host:'localhost',port:6379});
Promise.all([r.set('grab:stock:1:3','5'), r.del('grab:user-hold:2004:1:3')]).then(async()=>{console.log('redis_stock_before='+await r.get('grab:stock:1:3')); r.disconnect();});
NODE
IDEM=verify-normal-$(date +%s%N)
curl -s -m 40 -X POST http://localhost:3002/api/grab/requests -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"sessionId\":1,\"ticketTypeId\":3,\"quantity\":1,\"idempotencyKey\":\"$IDEM\"}"
```

Expected: response data has `status: "ORDER_CREATED"` and a non-null `orderId`.

- [ ] **Step 4: Run JMeter GUI plan**

In the already-open JMeter GUI:

1. Open `nestjs/grab-service/jmeter/grab-1000-concurrent-100-stock.jmx`.
2. Ensure the working directory is `nestjs/grab-service/jmeter` or set CSV path to the absolute CSV path.
3. Start the plan.
4. Wait for all 1000 samples to finish.

Expected JMeter Summary Report:

```text
Samples: 1000
Error %: 0.00%
```

- [ ] **Step 5: Verify database and Redis after JMeter**

Run:

```bash
PGPASSWORD=123456 psql -h localhost -p 5432 -U postgres -d omni_order -t -A -F '|' -c "select count(*) as load_orders, count(distinct id) as distinct_orders from \"order\" where session_id=1 and ticket_type_id=3 and user_id between 300001 and 301000;"
PGPASSWORD=123456 psql -h localhost -p 5432 -U postgres -d omni_grab -t -A -F '|' -c "select status, count(*) from grab_request where idempotency_key like 'jmeter-1000-100-%' group by status order by status;"
node - <<'NODE'
const Redis=require('ioredis');
const r=new Redis({host:'localhost',port:6379});
r.get('grab:stock:1:3').then(v=>{console.log('redis_stock_after_jmeter='+v); r.disconnect();});
NODE
```

Expected:

```text
100|100
ORDER_CREATED|100
SOLD_OUT|900
redis_stock_after_jmeter=0
```

If prior load-test orders exist, compare against a before-count baseline instead of requiring total count exactly 100.

---

## Self-Review

- Spec coverage: request ID collision is addressed by Task 1; JMeter artifact and manual GUI execution are addressed by Task 2 and Task 3; Nacos discovery issue is documented as a runtime startup constraint and no code change is needed because `start-project.ps1` already avoids disabling discovery.
- Placeholder scan: no TBD/TODO placeholders remain; all code and command steps include concrete content.
- Type consistency: `generateRequestId()` remains private and returns `string`; response statuses match existing `GRAB_STATUS` values; JMeter variables match request body fields used by `SubmitGrabRequestDto`.
