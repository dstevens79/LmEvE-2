# LMeve - EVE Online Corporation Management

A database-first corporation management tool for EVE Online with ESI integration for authentication and personal character data.

## Features

### Core Functionality
- **Member Management** - Character tracking with portraits and role assignment
- **Assets** - 7-division hangar browser with category filtering and search
- **Manufacturing** - Active job tracking with blueprint management and cost analysis
- **Market** - Order monitoring with sales tracking and profit analysis
- **Wallet** - Multi-division support with transaction history and trend analysis
- **Buyback System** - Contract workflow with market price syncing
- **Planetary Interaction** - Colony tracking across corporation members
- **Corporation Projects** - Material requirement tracking and contribution monitoring

### Authentication
- EVE Online SSO (OAuth 2.0) for character authentication
- Local username/password for database users
- Role-based access control (Admin, Director, Manager, Auditor, Member, Recruit)
- Multi-corporation support

### Data Management
- Database-first architecture (MySQL/PostgreSQL)
- Background sync processes populate database from ESI
- Visual indicators showing data source and freshness
- Connection monitoring for database health
- Mock data for demo/testing (disabled once database configured)

### Interface
- Tabbed navigation with permission-based access
- Mobile and desktop view modes
- Dark space theme optimized for readability
- Real-time loading states and notifications

## Tech Stack

React 19 • TypeScript • Tailwind CSS • shadcn/ui • Framer Motion • Recharts • GitHub Spark KV

## Quick Start

1. Configure database connection (Settings → Database)
2. Set up ESI for corporation authentication (Settings → ESI)
3. Register your corporation
4. Assign user roles and permissions
5. Background sync processes will populate data

## Data Flow

**Database-First Architecture:**
1. **Primary Source**: Database (populated by background sync)
2. **ESI Usage**: Personal character data on login, background sync processes only
3. **Mock Data**: Demo data when database never configured (auto-disabled after setup)
4. **Tabs**: Read from database only - no direct ESI calls

## License

MIT License - Copyright GitHub, Inc.

---

Built with [GitHub Spark](https://githubnext.com/projects/github-spark)
