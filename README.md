# LMeve - EVE Online Corporation Management

A modern, comprehensive web-based corporation management tool for EVE Online that helps CEOs and directors efficiently manage member assets, manufacturing operations, market activities, and corporation logistics through seamless integration with both the EVE Online ESI API and persistent database storage.

## Overview

LMeve provides corporation leaders with a professional, data-driven interface for strategic planning, operational oversight, and member management. Built with a dual data source architecture, the application intelligently retrieves information from EVE Online's ESI API for real-time data while maintaining a persistent database for historical analysis and offline capability.

## Core Features

### Intelligent Data Integration
- **Dual Source Architecture**: Seamless integration between EVE Online ESI API and database storage with intelligent fallback mechanisms
- **Real-time ESI Integration**: Live connection to EVE's ESI API for up-to-date corporation data including members, assets, manufacturing jobs, wallet transactions, and market orders
- **Database Connectivity**: Persistent MySQL/PostgreSQL support for historical data, analytics, and offline access
- **Data Source Transparency**: Visual indicators showing whether data originates from ESI (live), database (historical), or cache (recent)
- **Smart Refresh System**: User-controlled data refresh with clear loading states and comprehensive error handling
- **Connection Monitoring**: Live status indicators for EVE Online API health and database connectivity

### Authentication & Security
- **Dual Authentication Methods**: Support for both local credentials and EVE Online SSO authentication
- **ESI OAuth Integration**: Secure authentication flow with EVE Online's OAuth system
- **Corporation Registration**: Register and manage multiple corporations with ESI credentials
- **Role-Based Access Control**: Granular permission system for controlling access to sensitive features
- **Token Management**: Automatic OAuth token refresh and secure credential storage

### Member Management
- **Character Tracking**: Monitor corporation members with character portraits and details from ESI
- **Role Assignment**: Assign and manage user roles (Admin, Director, Manager, Auditor, Member, Recruit)
- **Activity Monitoring**: Track member engagement and activity patterns
- **Character Information**: Display character and corporation details including portraits and logos via EVE image server

### Asset Management
- **Split-View Hangar Browser**: Seven corporation divisions listed on the left, detailed item contents on the right
- **Division Names**: Retrieves division names from ESI divisions endpoint with fallback to default "Hangar 1-7" naming
- **Category Filtering**: Filter assets by Materials, Blueprints, Ships, Ammo, Drones, and Components
- **Search Functionality**: Quick search across all assets with real-time filtering
- **Real-time Statistics**: Live count and volume calculations for asset inventories
- **Data Source Indicators**: Clear badges showing whether asset data comes from ESI or database

### Manufacturing & Industry
- **Active Job Tracking**: Monitor all active manufacturing jobs with real-time progress from ESI industry endpoints
- **Blueprint Management**: Comprehensive blueprint library with research levels and material efficiency tracking
- **Production Planning**: Advanced tools for creating production schedules with cost analysis and profit estimation
- **Material Requirements Planning**: Automatic calculation of material needs with availability tracking
- **Progress Monitoring**: Visual progress indicators for manufacturing jobs
- **Pause/Resume Controls**: Manage job execution with pause and resume capabilities
- **Completion Alerts**: Notifications when manufacturing jobs complete

### Corporation Projects
- **Project Hangars**: Define dedicated hangars for member material deliveries
- **Requirement Tracking**: Track project material requirements via ESI asset and container log endpoints
- **Delivery Matching**: Automatically match member deliveries to project needs
- **Progress Monitoring**: Real-time hangar scanning for project completion tracking
- **Member Contributions**: Track individual member contributions to corporation projects

### Market Management
- **Active Orders**: Track all corporation market orders (buy and sell) via ESI routes
- **Sales Monitoring**: Monitor completed sales with profit tracking and trend analysis
- **Top Performers**: Analyze best-selling items and market performance
- **Market Trends**: Visual graphs showing sales patterns and market activity
- **Order History**: Complete transaction history with filtering and search capabilities

### Wallet & Finance
- **Multi-Division Support**: Monitor all corporation wallet divisions with ESI integration
- **Profit/Loss Tracking**: Monthly profit/loss analysis per division
- **Transaction History**: Complete transaction log with live ESI data integration
- **Financial Trends**: Visual graphs for analyzing financial performance over time
- **Balance Monitoring**: Real-time wallet balance tracking across all divisions
- **Data Source Indicators**: Clear visibility into whether financial data is from ESI or database

### Buyback System
- **Item Cost Synchronization**: Real-time market price syncing from EVE ESI API
- **Trade Hub Configuration**: Support for multiple trade hubs (Jita, Amarr, Dodixie, Rens, Hek)
- **Automatic Price Fetching**: Retrieve current market prices from configured stations
- **Manual Price Overrides**: Custom pricing with exclude-from-sync option for specific items
- **Inline Price Editing**: Quick price adjustments directly in the interface
- **Price Source Tracking**: Display whether prices come from ESI, database, or manual entry
- **Contract Generation**: Generate contract validation keys for secure transactions
- **Multi-Stage Workflow**: Track contracts through stages (New → Waiting on Pilot → Awaiting Payment → Completed)
- **Pilot Assignment**: Assign contracts to specific pilots for processing
- **ISK Calculations**: Automatic payout calculations based on current pricing
- **Batch Sync**: Sync prices for multiple items simultaneously
- **Configurable TTL**: Set cache duration for market price data

### Planetary Interaction
- **Colony Tracking**: Monitor planetary colonies across all corporation members
- **Production Monitoring**: Track planetary production chains and output
- **Resource Management**: Oversee extraction and production rates
- **Colony Status**: Visual indicators for colony health and productivity
- **Multi-Character Support**: Aggregate planetary data across multiple characters

### Notifications & Alerts
- **Real-time Notifications**: Toast notifications for important events and updates
- **System Status**: Alerts for API connectivity issues or data sync problems
- **Job Completion**: Notifications when manufacturing jobs complete
- **Error Reporting**: Clear error messages with actionable recovery options

### Settings & Configuration
- **ESI Configuration**: Manage EVE Online SSO client credentials and scopes
- **Database Setup**: Configure MySQL/PostgreSQL connection parameters
- **Connection Testing**: Validate database connectivity before saving
- **Corporation Management**: Register and manage multiple corporations with ESI
- **Data Sync Preferences**: Configure automatic refresh intervals and sync behavior
- **User Preferences**: Customize interface settings and notification preferences
- **Theme Management**: Multiple theme presets with custom theme support
- **Permission Controls**: Granular role-based access control configuration

### User Interface
- **Tabbed Navigation**: Clean, organized interface with main feature tabs
- **Mobile & Desktop Views**: Toggle between mobile-optimized and desktop layouts
- **Professional Theme**: Dark space-themed design optimized for extended use
- **Visual Hierarchy**: Clear data presentation with professional typography
- **Loading States**: Transparent feedback during data operations
- **Empty States**: Helpful guidance when no data is available
- **Responsive Design**: Adaptive layouts for various screen sizes
- **Data Tables**: High-density data grids optimized for readability
- **Status Badges**: Color-coded indicators for data sources and system status

### Dashboard
- **Quick Overview**: Corporation health and activity metrics at a glance
- **Connection Status**: Live indicators for ESI and database connectivity
- **Key Metrics**: Summary cards for members, assets, manufacturing, and market activity
- **Recent Activity**: Latest transactions, jobs, and member actions
- **Alert Summary**: Important notifications and system alerts

## Technical Architecture

### Frontend Stack
- **React 19** with TypeScript for type-safe component development
- **Tailwind CSS** for utility-first styling with custom theme configuration
- **shadcn/ui** component library for consistent, accessible UI elements
- **Framer Motion** for purposeful animations and transitions
- **Phosphor Icons** for comprehensive icon coverage
- **Recharts** for data visualization and financial graphs
- **React Hook Form** for efficient form management
- **Sonner** for elegant toast notifications

### Data Management
- **@github/spark/hooks** for persistent key-value storage with `useKV`
- **Smart Caching**: Configurable TTL for API responses to optimize performance
- **Optimistic Updates**: Immediate UI feedback with background synchronization
- **Error Recovery**: Graceful degradation when data sources are unavailable

### Authentication
- **EVE Online SSO**: OAuth 2.0 integration with PKCE flow
- **Local Authentication**: Username/password system for database-backed users
- **Session Management**: Secure token storage with automatic refresh
- **Multi-Corporation Support**: Manage credentials for multiple corporations

### ESI Integration
- **OAuth 2.0**: Secure authentication with EVE Online
- **Scope Management**: Request appropriate scopes based on feature requirements
- **Rate Limiting**: Intelligent request throttling to respect ESI rate limits
- **Error Handling**: Comprehensive error handling with retry logic
- **Token Refresh**: Automatic renewal of expired access tokens

### Database Support
- **MySQL/PostgreSQL**: Compatible with both major database systems
- **Connection Pooling**: Efficient database connection management
- **Schema Management**: Automated schema validation and setup
- **Query Optimization**: Efficient data retrieval with proper indexing
- **Migration Support**: Schema versioning and upgrade paths

## Design Philosophy

LMeve embodies a professional, data-driven aesthetic that reflects the serious nature of corporation management in EVE Online. The interface prioritizes:

- **Clarity**: Dense data presentation without overwhelming complexity
- **Efficiency**: Quick access to critical information and common tasks
- **Transparency**: Clear visibility into data sources and system status
- **Professionalism**: Enterprise-grade design suitable for strategic planning
- **Reliability**: Intelligent fallbacks and error handling for uninterrupted access

## Use Cases

### For CEOs
- Monitor overall corporation health from the dashboard
- Track member activity and engagement
- Review financial performance across wallet divisions
- Oversee manufacturing and production pipelines
- Make strategic decisions based on real-time and historical data

### For Directors
- Manage member roles and permissions
- Coordinate manufacturing schedules
- Track project hangar deliveries and completion
- Analyze market performance and sales trends
- Process buyback contracts efficiently

### For Managers
- Monitor specific divisions (assets, manufacturing, market)
- Track inventory levels and material requirements
- Process member transactions and deliveries
- Generate reports for leadership review

### For Members
- View permitted corporation information
- Check project requirements and contribution status
- Access buyback pricing and contract information
- Monitor notifications relevant to their activities

## Getting Started

1. **Configure ESI Authentication** (Optional): Set up EVE Online SSO credentials in Settings → ESI
2. **Set Up Database** (Optional): Configure MySQL/PostgreSQL connection in Settings → Database
3. **Register Corporation**: Add your corporation using ESI authentication
4. **Assign Roles**: Configure user permissions based on organizational structure
5. **Start Managing**: Access real-time and historical data across all features

## Data Flow

The application employs a sophisticated data flow strategy:

1. **Primary**: Attempt to fetch from ESI API for real-time data
2. **Fallback**: Retrieve from database if ESI is unavailable or rate-limited
3. **Cache**: Use recent cached data to minimize API calls and improve performance
4. **Sync**: Background synchronization to keep database current with ESI data

Visual indicators throughout the interface show which data source is being displayed, ensuring transparency and user confidence in data freshness.

## License

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.

---

Built with [GitHub Spark](https://githubnext.com/projects/github-spark) for EVE Online corporation leaders who demand professional tools for virtual business management.
