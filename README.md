# FinTrack — The Everyday Money Decision Assistant

**FinTrack** (formerly SpendSense) is a modern, responsive personal finance application tailored for Indian households (INR ₹). Built with React, Vite, and Supabase, FinTrack empowers users to track cash flows, set category budgets, evaluate upcoming purchase affordability, import bank statements safely, and explore consent-based financial data workflows.

---

## ✨ Key Features

1. **Personal Finance Dashboard & Analytics**
   - Real-time monthly inflow, outflow, and net cashflow calculations.
   - Intelligent Needs vs. Wants segregation (50/30/20 budgeting framework).
   - Category spending distributions with visual charts and actionable alerts.
   - Active month selection and historical monthly totals.

2. **Secure Transaction Management**
   - Cloud-persisted transactions in Supabase PostgreSQL with strict Row Level Security (RLS).
   - Seamless Personal Workspace and Sample Demo Mode switching.
   - Comprehensive CRUD (Create, Read, Update, Delete) with validation and optimistic UI updates.

3. **"Can I Afford This?" Purchase Simulator**
   - Algorithmic 3-tier affordability verdict:
     - 🟢 **Affordable**: Fits within cash cushion, category headroom, and upcoming bills.
     - 🟡 **Caution / Consider Waiting**: Tight liquidity or minor budget stretch.
     - 🔴 **Not Affordable**: Conflicts with essential liabilities or savings goals.
   - Transparent mathematical explanations and cashflow cushion projections.

4. **Intelligent CSV Statement Import**
   - Automatic header evaluation and smart column mapping for Indian bank statements.
   - SHA-256 fingerprinting and heuristics-based duplicate detection.
   - Batch cloud insertion with detailed diagnostic import summaries.

5. **Local-to-Cloud Migration Wizard**
   - Safe migration of browser `localStorage` transactions into authenticated Supabase cloud ledgers.
   - Automatic deduplication against cloud records with zero local data loss.

6. **Simulated Account Aggregator (AA) Demo**
   - RBI NBFC-AA consent framework demonstration.
   - Consent request, simulated approval, mock account linking, and automated statement ingestion using fictional banking data.

7. **Client-Side Privacy & Portability**
   - Schema-versioned browser storage with in-memory fallbacks.
   - Portable `.json` export and snapshot restore with structural validation.
   - Zero credential scraping — your bank passwords and OTPs are never requested.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, JavaScript (ES modules)
- **Build Tool**: Vite
- **Icons**: Lucide React
- **Backend & Auth**: Supabase (PostgreSQL, GoTrue Auth, RLS)
- **Styling**: Vanilla CSS Design Tokens, Glassmorphism, and Fluid Typography

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/sai-coder1/Fintrack.git
cd Fintrack

# Install dependencies
npm install
```

### 3. Environment Configuration
Create a `.env.local` file in the project root based on `.env.example`:
```bash
cp .env.example .env.local
```

Fill in your Supabase project credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Build for Production
```bash
npm run build
```

---

## 🔒 Security & Privacy Notice

FinTrack is an educational prototype and hackathon project. Browser `localStorage` is unencrypted. Real bank account passwords, netbanking PINs, debit/credit card CVVs, or sensitive government identity credentials (Aadhaar/PAN) should never be entered into the application.

---

## 📄 License

MIT License. Designed with care for Indian Rupee (INR) personal budgeting.
