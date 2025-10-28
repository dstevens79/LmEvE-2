# LMeve - EVE Online Corporation Management

A web-based corporation management tool for EVE Online that integrates with the ESI API and database storage to help manage members, assets, manufacturing, market operations, and finances.

## Features

### Data Integration
- Dual data source support: EVE Online ESI API and MySQL/PostgreSQL database
- Visual indicators showing data source (ESI, database, or cache)
- Connection monitoring for ESI and database health
- User-controlled data refresh with loading states

### Authentication
- EVE Online SSO (OAuth 2.0)
- Local username/password authentication
- Role-based access control (Admin, Director, Manager, Auditor, Member, Recruit)
- Multi-corporation support

### Member Management
- Character tracking with portraits from ESI
- Role assignment and permission management
- Activity monitoring

### Assets
- Split-view hangar browser with 7 corporation divisions
- Category filtering (Materials, Blueprints, Ships, Ammo, Drones, Components)
- Real-time search and statistics
- Division names from ESI with fallback defaults

### Manufacturing
- Active job tracking from ESI industry endpoints
- Blueprint management with research levels
- Production planning with cost analysis
- Material requirements calculation
- Progress monitoring and job controls

### Corporation Projects
- Project hangar configuration
- Material requirement tracking via ESI
- Delivery matching and progress monitoring
- Member contribution tracking

### Market
- Active market orders (buy/sell) via ESI
- Sales monitoring with profit tracking
- Performance analysis and trends
- Transaction history with filtering

### Wallet
- Multi-division wallet support
- Profit/loss tracking by division
- Transaction history with ESI integration
- Financial trend analysis

### Buyback System
- Market price syncing from ESI
- Trade hub configuration (Jita, Amarr, Dodixie, Rens, Hek)
- Manual price overrides with sync exclusion
- Contract workflow (New → Waiting → Payment → Completed)
- Pilot assignment and ISK calculations
- Batch price synchronization

### Planetary Interaction
- Colony tracking across corporation members
- Production chain monitoring
- Resource extraction oversight
- Multi-character aggregation

### Settings
- ESI configuration and scope management
- Database connection setup with testing
- Corporation registration
- Theme management with multiple presets
- Permission controls

### Interface
- Tabbed navigation
- Mobile and desktop view toggle
- Dark space theme
- Data tables with status badges
- Loading and empty states
- Dashboard with metrics and activity

## Tech Stack

- React 19 with TypeScript
- Tailwind CSS with shadcn/ui components
- Framer Motion for animations
- Phosphor Icons
- Recharts for visualization
- React Hook Form
- Sonner for notifications
- GitHub Spark KV storage

## Getting Started

1. Set up ESI authentication in Settings → ESI (optional)
2. Configure database connection in Settings → Database (optional)
3. Register your corporation via ESI
4. Assign user roles
5. Access features based on permissions

## Data Flow

1. Primary: ESI API for real-time data
2. Fallback: Database if ESI unavailable
3. Cache: Recent data to reduce API calls
4. Sync: Background updates to keep database current

## License

MIT License - Copyright GitHub, Inc.

---

Built with [GitHub Spark](https://githubnext.com/projects/github-spark)
