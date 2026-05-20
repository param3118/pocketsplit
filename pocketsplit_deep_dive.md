# PocketSplit — Complete Project Deep Dive

## What Is PocketSplit?

**PocketSplit** is a **roommate/group expense-splitting web application** — essentially a self-hosted, lightweight clone of Splitwise. It lets a group of people (roommates, trip buddies, teams) log shared expenses, automatically split bills, track who owes whom, and record settlements — all backed by a smart debt-simplification algorithm.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                        │
│            React 18 SPA  (port 3000 in dev)             │
│   Axios → /api/*  (proxied to Express in dev)           │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP / REST JSON
┌────────────────────▼────────────────────────────────────┐
│               EXPRESS.JS BACKEND  (port 5000)           │
│  Middleware: Logger → CORS → JSON parser → Routes       │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Group    │  │ Member   │  │ Expense  │  │Balance │  │
│  │Controller│  │Controller│  │Controller│  │Service │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│                        │                                │
│              ┌──────────▼───────────┐                   │
│              │   @libsql/client      │                   │
│              │ (Turso-compatible     │                   │
│              │  SQLite driver)       │                   │
│              └──────────┬───────────┘                   │
└─────────────────────────│───────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
   ┌──────▼──────┐ ┌──────▼──────┐  (cloud)
   │ Local .db   │ │ Turso Cloud │
   │ (dev/self-  │ │  (prod DB)  │
   │  hosted)    │ │             │
   └─────────────┘ └─────────────┘
```

---

## Full Tech Stack

| Layer | Technology | Why This Choice |
|---|---|---|
| **Frontend Framework** | React 18 (CRA) | Component reusability, hooks-based state, large ecosystem |
| **Frontend HTTP** | Axios | Cleaner API than `fetch`, interceptors, auto JSON parsing |
| **Frontend Styling** | Vanilla CSS (CSS variables) | Zero runtime cost, no build overhead, full control |
| **Backend Runtime** | Node.js | Same language on both sides, async I/O perfect for DB-heavy apps |
| **Backend Framework** | Express.js | Minimal, unopinionated, huge middleware ecosystem |
| **Database Driver** | `@libsql/client` | Speaks both local SQLite file AND Turso cloud — one codebase for both envs |
| **Database** | SQLite (local) / Turso (prod) | SQLite = zero-config dev; Turso = edge-deployed distributed SQLite in prod |
| **Containerization** | Docker (multi-stage) | Reproducible builds, small final image, prod-grade deployment |
| **CI/CD** | GitHub Actions | Free, tightly integrated with GitHub, auto Docker push to GHCR |
| **Frontend Hosting** | Vercel | Zero-config React deployment, edge CDN |
| **Backend Hosting** | Render | Free tier Node.js hosting with health checks |
| **Env Management** | dotenv | Industry standard, keeps secrets out of code |

---

## Why Each Technology Was Chosen (Logical Reasoning)

### React 18 (Create React App)
> *"Why not Next.js or Vite?"*

This is a **single-page client app** with no SEO requirement. CRA was chosen for simplicity — no server-side rendering needed. The app is fully client-side after the initial HTML load.

### `@libsql/client` + SQLite/Turso
> *"Why not PostgreSQL or MongoDB?"*

This is the **most architecturally interesting choice**. The `@libsql/client` library speaks a unified API that works with:
- **`file:./pocketsplit.db`** → Local SQLite file (zero setup for development)
- **`libsql://...turso.io`** → Turso cloud (distributed SQLite with replication in production)

This gives you the **simplest possible dev experience** while still being **production-grade** — all without changing a single line of application code. Just swap the environment variables.

### Express.js
> *"Why not Fastify or Koa?"*

Express is mature, has the widest middleware ecosystem, and its simplicity fits the project scope. The app uses custom middleware (logger, errorHandler) instead of heavy plugins anyway.

### Docker Multi-Stage Build
> *"Why multi-stage?"*

Stage 1 builds the React app (`npm run build`) inside a Node container and throws away all dev dependencies. Stage 2 copies only the compiled `build/` folder + backend code, resulting in a **lean final image** — no `node_modules` for the frontend, no React toolchain in production.

### Vanilla CSS with CSS Variables
> *"Why not Tailwind or a UI library?"*

Using CSS custom properties (`--bg`, `--accent`, `--border`) as a design token system gives full control with zero runtime cost. Every component reads from the same variables, so theming is trivially centralized.

---

## Database Schema — Entity Relationship

```
users ──────────────┐
  id (PK)           │
  name (UNIQUE)     │
                    │
groups_table        │
  id (PK)           │
  name              │
                    │
group_members ──────┤  (bridge table: N:N between users & groups)
  group_id (FK)     │
  user_id (FK)      │
                    │
expenses ───────────┤
  id (PK)           │
  transaction_id    │  ← "EXP-20260519-0001" (human-readable, unique)
  group_id (FK)     │
  title             │
  total_amount      │  ← stored as INTEGER paise/cents (no float money bugs)
  paid_by (FK)      │
  split_type        │  ← 'equal' | 'unequal'
  is_deleted        │  ← soft delete flag
                    │
expense_shares ─────┤  (how much each user owes for an expense)
  expense_id (FK)   │
  user_id (FK)      │
  share_amount      │
                    │
expense_payment_status  (dual-handshake payment tracking)
  expense_id (FK)   │
  user_id (FK)      │
  is_paid           │  ← 0=pending, 1=sent(debtor claimed), 2=verified(creditor confirmed)
  paid_at           │
                    │
settlements ────────┘  (direct lump-sum payment between two users)
  transaction_id        ← "SET-20260519-0001"
  group_id (FK)
  payer_id (FK)
  receiver_id (FK)
  amount

txn_counter             (auto-incrementing per-day sequence for IDs)
  prefix (PK)           ← "EXP_20260519"
  last_seq
```

### Key Design Decisions in Schema

**Amounts stored as integers (paise/cents):** Floating-point arithmetic on money causes rounding bugs. Storing `₹150.75` as `15075` paise keeps all math exact.

**Soft deletes (`is_deleted = 1`):** Expenses are never hard-deleted. This preserves audit history and keeps balance calculations accurate.

**`expense_payment_status.is_paid` as 0/1/2:** This encodes the **dual-handshake protocol** directly as a state machine column (see below).

---

## Step-by-Step Working Flow

### Flow 1: App Startup

```
1. Node.js starts server/index.js
2. Express mounts middleware: logger → cors → json parser
3. getDb() called:
   a. Checks for TURSO_DATABASE_URL env var
   b. If found → connects to Turso cloud
   c. If not → opens local pocketsplit.db SQLite file
   d. Runs initSql (CREATE TABLE IF NOT EXISTS...)
4. seed() runs → inserts demo groups/users if DB is empty
5. Express listens on PORT (default 5000)
6. React frontend (if built) is served as static files from /client/build
```

### Flow 2: User Visits the App

```
Browser loads index.html
  → React mounts App.jsx
  → useEffect: fetchGroups() → GET /api/groups
  → Sets currentGroup = groups[0] (first group)
  → useEffect (currentGroup dependency): fires 4 parallel requests:
      Promise.all([
        fetchExpenses(groupId),   → GET /api/expenses/:groupId
        fetchBalances(groupId),   → GET /api/balances/:groupId
        fetchMembers(groupId),    → GET /api/members/:groupId
        fetchSettlements(groupId) → GET /api/settlements/:groupId
      ])
  → State updates → React re-renders dashboard
```

### Flow 3: Adding an Expense

```
User clicks "+ Add Expense"
  → AddExpenseModal opens
  → User fills: title, amount, paid_by, split_type, participants

POST /api/expenses
  → expenseController.createExpense()
  → Input validation (title not empty, amount > 0, valid split_type)
  → Verify group exists
  → Verify paid_by is a group member
  → Verify all participants are group members
  
  → If split_type === 'equal':
       computeEqualShares(totalAmount, participants)
       (Uses Math.floor + distributes remainder paise to first N users)
       e.g. ₹100 split 3 ways → [34, 33, 33] paise-exact
  
  → If split_type === 'unequal':
       validateShares() ensures shares sum == totalAmount
  
  → generateTxnId('EXP') → "EXP-20260519-0001"
       (Atomically increments txn_counter for today's date)
  
  → INSERT into expenses table
  → INSERT into expense_shares (one row per participant)
  → INSERT into expense_payment_status:
       paid_by user → is_paid = 2 (already verified, they paid)
       all others   → is_paid = 0 (pending)
  
  → Returns 201 with new expense
  → Client calls refresh() → reloads all group data
```

### Flow 4: Dual-Handshake Payment Protocol

This is the **core innovation** of PocketSplit. A payment goes through two explicit steps to prevent disputes:

```
STATE MACHINE per participant per expense:

  [0: PENDING] ──→ (Debtor clicks "Mark Sent")
       │
       ▼
  [1: SENT] ──→ (Creditor clicks "Verify Received")
       │
       ▼
  [2: VERIFIED / PAID]

Step 1: POST /api/expenses/:id/mark-sent  { user_id }
  → Checks is_paid === 0 (must be pending)
  → Sets is_paid = 1
  → "Waiting for creditor verification"

Step 2: POST /api/expenses/:id/mark-paid  { user_id }
  → Checks is_paid !== 2 (not already done)
  → Sets is_paid = 2, paid_at = now()
  → "Payment verified and settled"

Expense status is derived:
  ALL shares is_paid === 2  → status: 'paid'
  ANY share  is_paid >= 1   → status: 'partial'
  else                      → status: 'pending'
```

**Why this matters:** Without the two-step, a debtor could unilaterally claim they paid. The creditor must confirm receipt. This mirrors how real payment apps (GPay UPI) work.

### Flow 5: Balance Calculation & Debt Simplification

```
GET /api/balances/:groupId
  → balanceService.computeBalances(groupId)

Algorithm:
  1. Fetch all group members → Initialize balanceMap = { userId: 0 }
  2. For each non-deleted expense:
       balanceMap[paid_by] += total_amount   (payer gets credit)
       for each share:
         balanceMap[user_id] -= share_amount  (each participant owes)
  3. For each settlement:
       balanceMap[payer_id]    -= amount  (they paid out)
       balanceMap[receiver_id] += amount  (they received)
  4. Result: positive balance = you're OWED money
             negative balance = you OWE money

Then → simplifyDebts():
  Uses GREEDY NET-BALANCE algorithm:
  1. Split into debtors (negative) and creditors (positive)
  2. Sort debtors ascending (most debt first)
  3. Sort creditors descending (most credit first)
  4. Two-pointer loop:
       amount = min(|debtor.balance|, creditor.balance)
       → create transaction: debtor pays creditor `amount`
       → reduce both balances
       → advance pointer when balance hits 0
  
  Result: MINIMAL set of transactions to settle all debts
  e.g. 4 people with 6 debts → simplified to 3 transfers
```

### Flow 6: Recording a Settlement

```
User sees "Alice should pay Bob ₹500"
User clicks "Settle"

POST /api/settlements
  → Generates transaction ID: "SET-20260519-0001"
  → Inserts into settlements table:
     { payer_id: Alice, receiver_id: Bob, amount: 500 }
  
  → Next time GET /api/balances runs:
       Alice's balance += 500 (she paid out)
       Bob's balance   -= 500 (he received)
       → Debt automatically disappears from suggestions
```

---

## Request Lifecycle (Middleware Chain)

```
HTTP Request
    │
    ▼
logger middleware
  → Records method, URL, IP, user-agent
  → Hooks on res.finish to log status + duration
    │
    ▼
cors()
  → Allows cross-origin (dev: React on :3000 → Express on :5000)
    │
    ▼
express.json()
  → Parses JSON request body
    │
    ▼
Router → asyncHandler(controller)
  → asyncHandler wraps controller in try/catch
  → Any thrown error is passed to next(err)
    │
    ▼
errorHandler (if error)
  → Reads err.status or defaults to 500
  → Returns { success: false, error: message }
    │
    ▼
HTTP Response
```

---

## Transaction ID System

Every expense and settlement gets a **human-readable, sortable, unique ID**:

```
Format: PREFIX-YYYYMMDD-NNNN
Examples:
  EXP-20260519-0001  (first expense of the day)
  EXP-20260519-0002  (second expense)
  SET-20260519-0001  (first settlement)

How it works:
  1. Key = "EXP_20260519" (prefix + date)
  2. SELECT last_seq FROM txn_counter WHERE prefix = key
  3. If exists: seq = last_seq + 1 → UPDATE
  4. If not: seq = 1 → INSERT
  5. Return "EXP-20260519-0001"

Why not UUID?
  UUIDs are random, non-sortable, ugly in UIs.
  This format is: sortable by date, readable, audit-friendly.
```

---

## Frontend Architecture

```
App.jsx (root state container)
├── Header.jsx
│     ├── Group switcher dropdown
│     ├── User identity selector (stored in localStorage)
│     └── "New Group" button
│
├── SummaryCards.jsx
│     ├── Total Expenses card
│     ├── You Are Owed card
│     └── You Owe card
│
├── Tab: "📋 Expenses" → ExpenseTimeline.jsx
│     ├── Lists all expenses (newest first)
│     ├── Each row shows: title, amount, paid_by, status badge
│     └── Click → ExpenseDetail.jsx (modal/drawer)
│           ├── Shows per-person shares
│           ├── Mark Sent button (if currentUser is a debtor)
│           ├── Verify Received button (if currentUser is the payer)
│           └── Edit / Delete expense
│
├── Tab: "⚖ Balances" → SettlementSuggestions.jsx
│     ├── Net balance for each member (bar chart style)
│     └── Simplified debt suggestions with "Settle" buttons
│
└── Tab: "🤝 History" → SettlementHistory.jsx
      └── Lists all recorded settlements

Modals:
├── AddExpenseModal.jsx  — Create/edit expense form
└── GroupManager.jsx     — Create/edit groups, add/remove members
```

**State management is intentionally kept simple** — React's built-in `useState` + `useEffect` + a `refreshKey` counter pattern. No Redux or Zustand needed at this scale. When any action mutates data, `refresh()` increments `refreshKey`, which triggers a `useEffect` to re-fetch all group data.

**Identity** (`currentUser`) is persisted in `localStorage` — so the app remembers who you are across page refreshes without any auth system.

---

## DevOps & Deployment Pipeline

```
Developer pushes to main branch
          │
          ▼
GitHub Actions (main.yml)
  1. Checkout code
  2. Setup Node 18
  3. npm install (pocketsplit/)
  4. npx mocha server/test.js (run tests)
  5. docker/login-action → GHCR (GitHub Container Registry)
  6. docker/metadata-action → generates image tags
  7. docker/build-push-action:
       → Dockerfile multi-stage build
       → Stage 1: Build React (node:18-alpine)
       → Stage 2: Final image (node:18-alpine, production only)
       → Push to ghcr.io/username/pocketsplit:latest
          │
          ▼
    Render pulls latest Docker image
    → Sets TURSO_DATABASE_URL + TURSO_AUTH_TOKEN env vars
    → Container starts, connects to Turso cloud DB
    → Health check: GET /api/health every 30s
```

**Vercel** is used for the static frontend (alternative deployment path):
- `vercel.json` rewrites `/api/*` → `api/index.js` (serverless function)
- All other routes → `client/build/index.html` (SPA catch-all)

---

## Environment Configuration

```
TURSO_DATABASE_URL=libsql://xxx.turso.io   # cloud DB
TURSO_AUTH_TOKEN=eyJ...                    # cloud DB token
DB_PATH=./pocketsplit.db                   # local DB fallback
PORT=5000                                  # server port
NODE_ENV=production                        # toggles JSON logging
```

The `getDb()` function checks: **if Turso credentials exist → use cloud, else → use local file**. This is the elegant dual-environment trick that makes local dev identical to production.

---

## Summary: Why This Stack Makes Sense Together

| Problem | Solution | Reason |
|---|---|---|
| Dev setup is painful | SQLite local file | Zero config, just run `node server/index.js` |
| Prod needs scalability | Turso (distributed SQLite) | Same driver, no code change |
| Money rounding bugs | Store amounts as integers (paise) | `Math.floor` is exact, floats are not |
| Payment disputes | Dual-handshake (0→1→2) | Debtor AND creditor must both confirm |
| N² debt complexity | Greedy net-balance algorithm | O(N log N) simplification, minimal transfers |
| Deployment repeatability | Docker multi-stage | Identical environment everywhere |
| Continuous delivery | GitHub Actions → GHCR | Automated test + build + push on every push to main |
| Audit trail | Soft deletes + TxnIDs | Nothing is permanently lost, every event is traceable |
