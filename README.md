# FinTrack — The Everyday Money Decision Assistant

**Make Every Rupee Count.**

FinTrack is a personal finance web application designed to help users understand their spending, manage budgets, track savings goals, forecast month-end expenses, and make more confident financial decisions.

Built with React, JavaScript, Vite, and Supabase, FinTrack combines transaction management, financial analytics, CSV statement imports, budget alerts, and a purchase affordability simulator in one responsive interface.

> **Project status:** Hackathon prototype under development. Account Aggregator functionality uses simulated data and does not establish a live bank connection.

## ✨ Key Features

### 1. Personal Finance Dashboard
- View monthly income, expenses, and net cash flow.
- Explore spending patterns through category-wise visualizations.
- Review historical financial activity and monthly summaries.
- Understand spending distribution and budget utilization.

### 2. Transaction Management
- Add, view, edit, and delete income and expense transactions.
- Organize transactions by category, date, and transaction type.
- Validate transaction inputs before saving.
- Use Supabase PostgreSQL for authenticated cloud transaction storage, subject to the configured database policies.

### 3. Budget Tracking and Savings Goals
- Set budgets to manage spending within selected limits.
- Monitor spending against budget allocations.
- Track progress toward savings goals.
- Receive in-app notifications when configured budget thresholds are crossed.

### 4. “Can I Afford This?” Purchase Simulator
Evaluate a proposed purchase using available financial information, such as income, expenses, budgets, and savings goals.

The simulator is designed to help users understand:
- The potential impact of a purchase on their available cash.
- Whether the purchase could stretch a category budget.
- Possible conflicts with planned expenses or savings goals.

The result is a decision-support estimate, not a guarantee of future affordability or a substitute for financial advice.

### 5. CSV Transaction Import
- Import supported CSV transaction files.
- Review imported transaction data and validation results.
- Identify invalid rows and potential duplicate transactions where supported.
- Reduce manual entry when transaction data is available in a compatible file format.

Import compatibility depends on the CSV structure and the application's current parsing and validation rules.

### 6. Financial Analytics and Forecasting
- Analyze historical income and expense patterns.
- Review category-level spending.
- Estimate potential month-end spending using available transaction history.

Forecasts are estimates based on recorded data. Their reliability depends on data completeness and the method implemented.

### 7. Smart Notifications
- Display in-app feedback for supported application events.
- Monitor configured budget thresholds.
- View and manage notifications through the notification center.
- Use optional browser notifications where supported and permitted by the user.

Notification persistence and browser notification availability depend on the application's implementation and browser settings.

### 8. Account Aggregator Demonstration
Explore a simulated financial-data-sharing workflow involving consent, sample account selection, transaction previews, and importing fictional banking data.

**Important:** This is a demonstration of a possible consent-based financial data workflow. It is not a live integration with RBI-regulated Account Aggregator infrastructure, and it does not automatically synchronize transactions from banks, PhonePe, or Google Pay.

### 9. Data Portability and Local Storage
FinTrack may use browser storage for supported local settings or prototype data workflows. Where implemented, data export and restoration features help users preserve or transfer their application data.

Browser storage is device- and browser-specific. It is not a substitute for a secure cloud backup.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React | Component-based user interface |
| JavaScript (ES modules) | Application logic |
| Vite | Development server and production build |
| CSS | Responsive styling and design system |
| Supabase Auth | User authentication |
| Supabase PostgreSQL | Cloud database |
| Row Level Security (RLS) | Database access restrictions, when correctly configured |
| Lucide React | Icons, where used |
| Vercel | Deployment, if configured |

The application uses INR (₹) as its initial currency focus.

## 🏗️ Application Architecture

```text
User
 |
 v
React + JavaScript Frontend
 |
 +---- Dashboard and Analytics
 |
 +---- Transactions and Budgets
 |
 +---- CSV Import and Validation
 |
 +---- Purchase Affordability Simulator
 |
 +---- Notifications and Settings
 |
 v
Supabase JavaScript Client
 |
 +---- Supabase Authentication
 |
 +---- PostgreSQL Database
       |
       +---- Transactions
       +---- Profiles (if configured)
       +---- Row Level Security Policies
```

Some prototype functionality may use browser storage or simulated data. The exact storage mechanism depends on the feature.

## 🚀 Getting Started

### Prerequisites

Install the following before running the project:

- [Node.js](https://nodejs.org/) — preferably a currently supported LTS version.
- npm, included with Node.js.
- Git.
- A Supabase project for features that require authentication or cloud database access.

### 1. Clone the repository

```bash
git clone https://github.com/sai-coder1/Fintrack.git
cd Fintrack
```

If your repository URL or capitalization differs, use the exact URL shown on your GitHub repository page.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root, alongside `package.json`.

Add your own Supabase project URL and publishable key:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Replace the placeholders with the values from your Supabase project's API settings.

If your repository contains an `.env.example` file, you can use it as a reference.

**Security notes:**
- Never commit `.env.local` or files containing real credentials.
- Never expose a Supabase service-role key or secret key in frontend code.
- Vite environment variables prefixed with `VITE_` are exposed to client-side code. Only put values intended for public client-side use there.
- Supabase Row Level Security and appropriate database policies are essential for protecting user data.

### 4. Start the development server

```bash
npm run dev
```

Open the local URL printed by Vite in your terminal. The default is usually:

`http://localhost:5173`

### 5. Build for production

```bash
npm run build
```

To preview the production build locally, run:

```bash
npm run preview
```

## 🗄️ Supabase Configuration

To use cloud authentication and transaction storage:

1. Create or select your Supabase project.
2. Configure the project URL and publishable key in `.env.local`.
3. Confirm that the application's required database tables and columns exist.
4. Configure authentication providers and redirect URLs for your local and deployed environments.
5. Verify that Row Level Security is enabled where required.
6. Verify that policies restrict users to the records they are authorized to access.
7. Test registration, sign-in, sign-out, and transaction operations.

The application code and database schema must agree on table names, column names, data types, and relationships. Do not assume that every schema is created automatically by the frontend.

Do not disable RLS to work around permission errors. Investigate the relevant policies and authentication state instead.

## 🔐 Security and Privacy

FinTrack is an educational and hackathon project, not a production-certified financial service.

- Never enter bank passwords, net banking PINs, card CVVs, OTPs, or sensitive identity credentials into the application.
- Do not assume browser `localStorage` data is encrypted.
- Use Supabase authentication and correctly configured database policies for protected cloud data.
- Do not commit API secrets, access tokens, or personal transaction exports to GitHub.
- Treat imported CSV files as sensitive financial information.
- Review authentication redirect URLs and environment variables before deployment.

A frontend application must not be treated as a trusted environment for secret credentials.

## 🧪 Testing

Before demonstrating or deploying FinTrack, test the features that are implemented in your current version.

### Authentication
- Register a test account.
- Sign in and sign out.
- Check validation and error messages.
- Confirm that protected pages require authentication.

### Transactions
- Add an income transaction and an expense transaction.
- Verify that dashboard totals update correctly.
- Edit and delete transactions if those actions are supported.
- Check that failed database operations do not display false success messages.

### CSV Import
- Import a valid CSV with a small number of test transactions.
- Test malformed rows and missing fields.
- Re-import the same file to evaluate duplicate handling.
- Verify the resulting transaction records and import summary.

### Budgets and Notifications
- Create a test budget.
- Add expenses that cross the configured notification thresholds.
- Check notification display, unread counts, and read or dismiss actions where implemented.

### Data Isolation
- Test with separate accounts.
- Confirm that one account cannot access another user's private transactions.
- Verify the relevant Supabase RLS policies rather than relying only on frontend restrictions.

Run the available project checks:

```bash
npm run build
git diff --check
```

If a dedicated automated test command is defined in `package.json`, run it as well. Report only tests that were actually executed and their real results.

## 🌐 Deployment

FinTrack can be deployed to a compatible static frontend hosting platform, such as Vercel, when the project configuration supports it.

For a typical Vite deployment:

1. Import the GitHub repository into Vercel.
2. Set the build command to `npm run build`.
3. Set the output directory to `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the deployment environment variables.
5. Configure Supabase authentication redirect URLs for the deployed domain.
6. Redeploy after changing environment variables.
7. Test authentication, database access, routing, and protected pages on the deployed site.

**Live demo:** Add your deployed application URL here once it is available.

## ⚠️ Current Limitations

- Account Aggregator functionality is simulated and uses fictional data.
- FinTrack cannot account for expenses that have not been entered or imported.
- CSV compatibility depends on the file format and implemented validation rules.
- Browser-local data and notifications may not synchronize across devices.
- Browser notifications depend on browser support, permissions, and the implementation's lifecycle.
- Spending forecasts and affordability assessments depend on available data and are estimates.
- Production readiness depends on further security review, testing, and deployment validation.

## 🛣️ Future Improvements

Potential areas for future development include:

- More robust CSV format detection and import diagnostics.
- Improved data quality checks and duplicate reconciliation.
- More comprehensive financial forecasting.
- Better accessibility and automated regression testing.
- Cross-device notification synchronization.
- Additional export and backup options.
- Integration with authorized financial data providers, subject to eligibility, consent, security, and applicable requirements.

## 🤝 Contributing

Contributions, bug reports, and suggestions are welcome.

1. Fork the repository or create a feature branch.
2. Make a focused change.
3. Test the affected functionality.
4. Review the changes before committing.
5. Submit a pull request with a clear explanation of the change.

Do not include credentials, personal financial records, or other sensitive data in commits or issues.

## 📄 License

FinTrack is licensed under the [MIT License](LICENSE).

---

**FinTrack — Make Every Rupee Count.**

Built as a personal finance decision-assistance project focused on clearer spending insights, more thoughtful budgeting, and better-informed everyday financial decisions.
