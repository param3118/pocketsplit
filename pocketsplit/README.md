# 💸 PocketSplit — Roommate Expense Splitter

## 📸 Overview

![PocketSplit Hero](pocketsplit_hero_v2_1778523057097.png)
*Modern dashboard with metric cards, member balances, and expense tracking.*

---

## 🔍 Project Overview

**PocketSplit** is a premium full-stack application designed for roommates to track shared expenses, split bills (equally or custom), and settle debts with minimal transactions.

### Key Engineering Principles:
- **Financial Integrity**: All calculations use integer paise (no floating-point rounding errors).
- **Dynamic Ledger**: Balances are never stored; they are computed on-the-fly from the transaction history to ensure 100% consistency.
- **Smart Settlements**: Implements a **Greedy Debt Minimization Algorithm** to resolve complex group debts in the fewest possible transactions.
- **Persistence**: Powered by a robust SQLite backend with soft-deletion and immutable settlement records.

---

### Expense Timeline
![Expense Timeline](screenshots/expense-timeline.png)
*Expenses grouped by date with expandable day views showing transaction IDs and payment status*

### Expense Details
![Expense Details](screenshots/expense-details.png)
*Detailed breakdown of a single expense — shares, payment status, and mark-paid workflow*

### Balance & Settlement Suggestions
![Balances](screenshots/balances.png)
*Net balances and debt-simplified settlement suggestions — minimized to fewest transactions*

### Settlement History
![Settlement History](screenshots/settlement-history.png)
*Immutable log of all completed settlements with transaction IDs*

---

## 🔍 Project Overview

**PocketSplit** is a backend-focused full-stack web application designed for roommates to track shared expenses, split bills (equally or custom), monitor payment statuses, and settle debts with minimal transactions.

The core engineering emphasis is on:
- **Financial correctness** — all money in integer paise (no floats)
- **Immutable ledger** — balances never stored, always dynamically recomputed
- **Debt minimization** — greedy net-balance algorithm reduces N debts to as few transactions as possible
- **One-way payment transitions** — PENDING → PAID is irreversible
- **Clean architecture** — service/controller/route separation with async error handling

---

## ✨ Features

| Feature | Details |
|---|---|
| **Group Management** | Create, rename, delete groups with member tracking |
| **Expense CRUD** | Add, view, edit, soft-delete expenses |
| **Equal Split** | Integer-safe division with remainder distribution |
| **Custom Split** | Manual share entry with validation (sum must equal total) |
| **Payment Tracking** | Per-participant PAID/PENDING status with timestamp |
| **Mark Paid** | One-way state transition — once paid, always paid |
| **Dynamic Balances** | Recomputed from scratch on every request |
| **Debt Simplification** | Greedy algorithm minimizes settlement transactions |
| **Settlement Records** | Immutable history with unique transaction IDs |
| **Transaction IDs** | Human-readable: `EXP-20260511-0001`, `SET-20260511-0001` |
| **Date Timeline** | Expenses grouped by date, expandable day views |
| **Demo Seed Data** | Auto-seeds demo group with 4 members and 5 expenses |

---

## 🛠 Tech Stack

### Backend
| Tech | Purpose |
|---|---|
| **Node.js + Express** | REST API server |
| **sql.js** | Pure JavaScript SQLite (no native compilation) |
| **uuid** | Unique ID generation |

### Frontend
| Tech | Purpose |
|---|---|
| **React 18** | Component-based UI with hooks |
| **Axios** | HTTP client for API calls |
| **CSS Custom Properties** | Dark theme design tokens |
| **DM Sans + Space Mono** | Typography — clean sans + monospace for amounts |

---

## 🏗 System Design Overview

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                     │
│  SummaryCards | ExpenseTimeline | SettlementPanel    │
└──────────────────────┬──────────────────────────────┘
                       │ Axios (HTTP)
┌──────────────────────▼──────────────────────────────┐
│               Express.js REST API                    │
│    Routes → Controllers → Services → DB              │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                 SQLite (sql.js)                      │
│   users | groups | expenses | shares | settlements   │
└─────────────────────────────────────────────────────┘
```

**Key architectural decisions:**
1. **Balances are never persisted** — computed dynamically from expenses + shares + settlements
2. **Soft deletes on expenses** — historical integrity maintained; `is_deleted=1` hides from UI
3. **Service layer** separates business logic from HTTP concerns
4. **Integer-only money** — amounts stored as paise; ₹19.99 = `1999`

---

## 🗄 Database Schema

```sql
users
  id, name (UNIQUE), created_at

groups_table
  id, name, created_at

group_members
  group_id FK, user_id FK
  PRIMARY KEY (group_id, user_id)

expenses
  id, transaction_id (UNIQUE), group_id FK, title
  total_amount (INTEGER paise), paid_by FK
  split_type (equal|unequal), note
  is_deleted (soft delete), created_at

expense_shares
  id, expense_id FK, user_id FK, share_amount (INTEGER)

expense_payment_status
  id, expense_id FK, user_id FK
  is_paid (0|1), paid_at

settlements
  id, transaction_id (UNIQUE), group_id FK
  payer_id FK, receiver_id FK
  amount (INTEGER paise), note, created_at

txn_counter
  prefix PK, last_seq
  (tracks per-day sequence numbers for transaction IDs)
```

---

## ⚙ Key Functionalities

### 1. Integer-Safe Equal Split

```javascript
function computeEqualShares(totalAmount, participants) {
  const n = participants.length;
  const base = Math.floor(totalAmount / n);
  const remainder = totalAmount - base * n;

  // Distribute remainder paise to first N participants
  return participants.map((userId, i) => ({
    user_id: userId,
    share_amount: i < remainder ? base + 1 : base
  }));
}
```

**Example:** ₹1000 / 3 = ₹333.33 + ₹333.33 + ₹333.34  
Stored as: 33334, 33333, 33333 paise

### 2. Dynamic Balance Calculation

```
balance = money_paid - money_owed + settlements_received - settlements_paid
```

- Positive balance → user should **receive** money
- Negative balance → user **owes** money
- Recalculated from raw tables on every `/balances/:groupId` request

### 3. Payment Status Workflow

```
PENDING ──→ PAID
   ↑
   └── Cannot reverse (ledger consistency)
```

The payer is automatically marked `PAID` at expense creation time. Other participants default to `PENDING`.

---

## 🧮 Debt Simplification Logic

The naive approach records one transaction per debt pair. With 4 people, this could mean up to 6 transactions.

**PocketSplit uses a greedy net-balance algorithm:**

```javascript
async function simplifyDebts(groupId) {
  const balances = await computeBalances(groupId);

  // Split into debtors (negative) and creditors (positive)
  const debtors  = balances.filter(b => b.balance < 0).sort(...);
  const creditors = balances.filter(b => b.balance > 0).sort(...);

  const transactions = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(-debtors[i].balance, creditors[j].balance);
    transactions.push({ from: debtors[i], to: creditors[j], amount });

    debtors[i].balance  += amount;
    creditors[j].balance -= amount;

    if (debtors[i].balance  === 0) i++;
    if (creditors[j].balance === 0) j++;
  }

  return transactions;
}
```

**Example:**

```
Before simplification:
  Rahul owes Param ₹500
  Aman  owes Param ₹300
  Aman  owes Priya ₹200

After (net balance):
  Param net: +₹800
  Priya net: +₹200
  Rahul net: -₹500
  Aman  net: -₹500

Simplified (2 transactions instead of 3):
  Rahul → Param: ₹500
  Aman  → Param: ₹300
  Aman  → Priya: ₹200
```

The algorithm guarantees the **minimum number of transactions** needed to settle all debts.

---

## 🔄 Payment Workflow

```
Expense Created
      │
      ├──→ Payer marked PAID immediately (auto)
      │
      └──→ All others marked PENDING
                  │
                  ▼
         Click "Mark Paid" (UI)
                  │
                  ▼
         POST /expenses/:id/mark-paid
                  │
                  ├── Check: already PAID? → 400 Error
                  │
                  └── Set is_paid=1, paid_at=now()
                              │
                              ▼
                   Balances recomputed on next fetch
                   Settlement suggestions updated
```

---

## 🌐 API Endpoints

### Groups
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/groups` | List all groups |
| `GET` | `/api/groups/:id` | Get group with members |
| `POST` | `/api/groups` | Create group |
| `PUT` | `/api/groups/:id` | Rename group |
| `DELETE` | `/api/groups/:id` | Delete group (soft-deletes expenses) |

### Members
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/members/:groupId` | List group members |
| `POST` | `/api/members` | Add member to group |
| `DELETE` | `/api/members/:groupId/:userId` | Remove member (blocked if pending balance) |

### Expenses
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/expenses/:groupId` | List expenses with shares + status |
| `GET` | `/api/expense/detail/:id` | Full expense detail |
| `POST` | `/api/expenses` | Create expense |
| `PUT` | `/api/expenses/:id` | Edit expense (recomputes shares) |
| `DELETE` | `/api/expenses/:id` | Soft delete |
| `POST` | `/api/expenses/:id/mark-paid` | Mark participant paid |

### Balances & Settlements
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/balances/:groupId` | Net balances + simplified debts |
| `POST` | `/api/settlements` | Record a settlement |
| `GET` | `/api/settlements/:groupId` | Settlement history |

---

## ⚠ Edge Cases Handled

| Edge Case | Handling |
|---|---|
| `amount <= 0` | 400 error: "Amount must be a positive integer" |
| Empty participants | 400 error: "participants array is required and non-empty" |
| Unequal split mismatch | 400 error: shows sum vs expected total |
| Duplicate member in group | 409 error: "A member with this name already exists" |
| Marking already-PAID user | 400 error: "Cannot reverse" |
| Division remainder (₹1000/3) | Distributed to first N participants |
| Remove member with dues | 400 error: "Cannot remove member with pending balance" |
| Delete group with expenses | Soft-deletes all expenses first |
| Invalid transaction ID | Unique constraint; sequential generation |
| Payer not in group | 400 error: "Payer is not a member" |
| Settlement: same payer/receiver | 400 error: "cannot be the same" |
| Foreign key violations | SQLite FK constraints enabled |

---

## 📁 Folder Structure

```
pocketsplit/
├── server/
│   ├── index.js                 # Express app + startup
│   ├── routes/
│   │   └── index.js             # All route definitions
│   ├── controllers/
│   │   ├── groupController.js   # Group CRUD
│   │   ├── memberController.js  # Member CRUD
│   │   ├── expenseController.js # Expense CRUD + mark-paid
│   │   └── balanceController.js # Balances + settlements
│   ├── services/
│   │   ├── balanceService.js    # Dynamic balance + debt simplification
│   │   └── txnIdService.js      # Transaction ID generator
│   ├── db/
│   │   ├── database.js          # SQLite singleton
│   │   ├── init.js              # Schema SQL
│   │   └── seed.js              # Demo data
│   ├── middleware/
│   │   └── errorHandler.js      # Error handler + asyncHandler
│   └── utils/
│       └── validators.js        # Input validation utilities
│
├── client/
│   ├── public/index.html
│   └── src/
│       ├── App.jsx              # Root component + state management
│       ├── index.js             # React entry point
│       ├── index.css            # Design tokens + global styles
│       ├── utils.js             # Formatting utilities
│       ├── api/api.js           # Axios API client
│       └── components/
│           ├── Header.jsx           # Sticky header + group switcher
│           ├── SummaryCards.jsx     # 4 metric cards
│           ├── ExpenseTimeline.jsx  # Date-grouped expense list
│           ├── ExpenseDetail.jsx    # Modal: expense breakdown
│           ├── SettlementSuggestions.jsx  # Balances + simplified debts
│           ├── SettlementHistory.jsx      # Past settlements
│           ├── AddExpenseModal.jsx        # Expense creation form
│           └── GroupManager.jsx           # Group/member management
│
├── screenshots/                 # UI screenshots
├── pocketsplit.db               # SQLite database (auto-created)
├── package.json
└── README.md
```

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+ 
- npm 8+

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/pocketsplit.git
cd pocketsplit

# Install backend dependencies
npm install

# Install and build frontend
cd client
npm install
npm run build
cd ..
```

### Running

```bash
# Start the server (serves built frontend + API)
node server/index.js
```

Open **http://localhost:5000** in your browser.

The app auto-seeds demo data on first run:
- Group: **"Flat 4B - Rooftop Squad"**
- Members: **Param, Rahul, Aman, Priya**
- 5 sample expenses with mixed statuses
- 1 sample settlement

### Development Mode

```bash
# Terminal 1: Start backend
node server/index.js

# Terminal 2: Start frontend dev server (hot reload)
cd client
npm start
# Opens http://localhost:3000 (proxies API to :5000)
```

---

## 🔮 Future Improvements

| Feature | Rationale |
|---|---|
| **Authentication** | Multi-user support with JWT sessions |
| **WebSockets** | Real-time balance updates across devices |
| **Push Notifications** | Alert when someone marks you as paid |
| **Receipt OCR** | Upload photo → auto-extract title + amount |
| **Recurring Expenses** | Auto-add monthly bills (rent, subscriptions) |
| **CSV Export** | Export expense history for accounting |
| **PostgreSQL migration** | Scale beyond single-server SQLite |
| **Expense Categories** | Tag expenses: food, utilities, transport |
| **Currency Support** | Multi-currency with exchange rates |
| **Mobile App** | React Native wrapper |

---

## ⚖ Tradeoffs Made

| Tradeoff | Decision | Reason |
|---|---|---|
| **Balance storage** | Never stored, always computed | Guarantees consistency; no stale state |
| **Float vs Integer** | Integer paise only | Eliminates floating-point rounding errors in money |
| **Hard vs Soft delete** | Soft delete for expenses | Preserves ledger history; hard delete for groups |
| **Auth skip** | No auth system | Complexity vs. demo scope; group-level access is fine for MVP |
| **Real-time** | Polling on action vs WebSocket | Simpler; sufficient for co-located users |
| **SQL vs NoSQL** | Relational SQLite | Financial data has natural relational structure with referential integrity needs |

---

## 🗃 Why SQLite Was Chosen

1. **Zero infrastructure** — no separate database server to manage
2. **File-based** — entire database in one `.db` file; trivial to backup
3. **ACID compliant** — full transaction support for financial data
4. **sql.js** — pure JavaScript implementation; no native compilation required
5. **Sufficient for scope** — handles thousands of expenses without performance concerns
6. **Easy migration** — schema is standard SQL; moving to PostgreSQL is straightforward

---

## 🔐 Why Authentication Was Skipped

- **Focus** — this project demonstrates backend financial logic and system design, not auth flows
- **Demo-friendly** — anyone can open the app and test immediately without registration
- **Group-level trust** — in real shared living scenarios, all roommates are trusted parties
- **Future addition** — JWT-based auth can be added as a middleware layer without changing business logic

---

## 🧑‍💻 Author

Built as a production-inspired engineering project demonstrating:
- Clean backend architecture
- Correct financial data handling
- Debt minimization algorithms
- CRUD operations with proper validation
- Maintainable, readable code

---

*PocketSplit — because splitting bills shouldn't be complicated.*