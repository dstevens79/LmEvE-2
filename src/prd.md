# LMeve - EVE Online Corporation Management Tool

## Core Purpose & Success
- **Mission Statement**: A modern web-based corporation management tool for EVE Online that helps CEOs and directors manage member assets, manufacturing, mining operations, and corporation logistics efficiently with real-time ESI and database integration.
- **Success Indicators**: Reduced time spent on manual corporation management tasks, improved member engagement tracking, streamlined asset and production oversight with live data from EVE Online and persistent database storage.
- **Experience Qualities**: Professional, efficient, comprehensive - feels like a serious business management tool for virtual corporations with enterprise-grade data integration.

## Project Classification & Approach
- **Complexity Level**: Complex Application (advanced functionality, multiple data views, corporation management features with dual data source architecture)
- **Primary User Activity**: Managing - CEOs and directors actively managing corporation operations, tracking member activities, and making strategic decisions using real-time and historical data.

## Thought Process for Feature Selection
- **Core Problem Analysis**: EVE Online corporations need comprehensive tools to track member assets, manufacturing operations, mining activities, and overall corp logistics beyond what the game provides natively.
- **User Context**: Corporation leaders using this tool during strategic planning sessions, regular check-ins, and operational oversight meetings.
- **Critical Path**: Login → Dashboard Overview → Drill into specific management areas (Members, Assets, Manufacturing, etc.) → Take action or generate reports.
- **Key Moments**: Quick dashboard overview, detailed member asset analysis, manufacturing pipeline monitoring.

## Essential Features
- **Tabbed Interface**: Core navigation between different management areas (Members, Assets, Manufacturing, Mining, Logistics, Market, Wallet, etc.)
- **Integrated Data Architecture**: Seamless integration between EVE Online ESI API and database with intelligent fallback - automatically fetches from ESI when available, falls back to database, with caching layer for performance
- **Real-time ESI Integration**: Live connection to EVE Online's ESI API for real-time corporation data including members, assets, manufacturing jobs, wallet transactions, and market orders
- **Database Connectivity**: Persistent data storage with MySQL/PostgreSQL support for historical data, analytics, and offline access
- **Data Source Transparency**: Clear visual indicators showing whether data comes from ESI (live), database (historical), or cache (recent)
- **Smart Data Refresh**: User-controlled data refresh with clear loading states and error handling
- **Real-time Data Dashboard**: Live connection status, API health monitoring, and automatic data refresh capabilities with visual ESI/Database connectivity status
- **Member Management**: Track corporation members fetched from ESI with character details, roles, and activity tracking
- **Asset Tracking**: Split-view hangar browser with 7 corporation divisions listed on left side, detailed item contents on right side with category-based filtering (Materials, Blueprints, Ships, Ammo, Drones, Components), search functionality, and real-time statistics. Retrieves division names from ESI divisions endpoint when available, falls back to "Hangar 1-7" naming. Displays data source for each asset list.
- **Manufacturing Job Scheduling**: Real-time tracking of active manufacturing jobs with progress monitoring, pause/resume capabilities, and completion alerts from ESI industry endpoints
- **Blueprint Management**: Comprehensive blueprint library with research levels, material efficiency tracking, and production planning
- **Production Planning**: Advanced planning tools for creating production schedules, cost analysis, and profit estimation
- **Material Requirements Planning**: Automatic calculation of material needs for manufacturing jobs with availability tracking
- **Mining Operations**: Monitor mining activities, ore processing, and resource allocation
- **Corporation Projects**: Define project hangars for material deliveries, track requirements via ESI asset and container log endpoints, match deliveries to project needs, and monitor progress with real-time hangar scanning
- **Market Analysis**: Track active corporation market orders (buy/sell) via ESI routes, monitor completed sales with profit tracking, analyze sales trends and top-performing items
- **Corporate Wallet Management**: Monitor all corporation wallet divisions with ESI integration, track monthly profit/loss per division, view transaction history with live ESI data, analyze financial trends with visual graphs, show data source indicators
- **Settings & Configuration**: Comprehensive settings panel for API key management, database configuration, sync preferences, and notification controls
- **Dashboard Overview**: Quick stats and alerts for corporation health and activity with live EVE Online connection status and database connectivity indicators

## Design Direction

### Visual Tone & Identity
- **Emotional Response**: Professional confidence, data-driven decision making, corporate efficiency
- **Design Personality**: Clean, professional, data-focused - should feel like enterprise software
- **Visual Metaphors**: Corporate dashboards, spreadsheet-like data presentation, space/sci-fi elements from EVE
- **Simplicity Spectrum**: Rich interface with comprehensive data presentation while maintaining clarity

### Color Strategy
- **Color Scheme Type**: Monochromatic with accent colors
- **Primary Color**: Deep space blue (#1a365d) - represents the vastness of space and corporate stability
- **Secondary Colors**: Steel grays (#2d3748, #4a5568) for data containers and secondary elements
- **Accent Color**: EVE Online orange (#f56500) for important actions and alerts
- **Color Psychology**: Blue conveys trust and stability, gray suggests professionalism, orange draws attention to critical actions
- **Color Accessibility**: High contrast ratios maintained throughout
- **Foreground/Background Pairings**: 
  - Background (#0f172a): White text (#f8fafc)
  - Card (#1e293b): Light gray text (#e2e8f0)
  - Primary (#1a365d): White text (#ffffff)
  - Secondary (#374151): Light text (#f3f4f6)
  - Accent (#f56500): White text (#ffffff)
  - Muted (#475569): Light gray text (#d1d5db)

### Typography System
- **Font Pairing Strategy**: Monospace for data/numbers (accuracy), sans-serif for UI text (clarity)
- **Typographic Hierarchy**: Clear distinction between headers, data labels, and values
- **Font Personality**: Technical, precise, readable - should feel like professional software
- **Readability Focus**: Tables and data grids need excellent readability for long sessions
- **Typography Consistency**: Consistent sizing and spacing for data presentation
- **Which fonts**: Inter for UI text, JetBrains Mono for data and numbers
- **Legibility Check**: Both fonts chosen for excellent screen readability at various sizes

### Visual Hierarchy & Layout
- **Attention Direction**: Tabbed navigation → Key metrics → Detailed data tables → Action buttons
- **White Space Philosophy**: Generous spacing around data sections, tighter spacing within data groups
- **Grid System**: Table-based layouts for data, card-based layouts for summaries
- **Responsive Approach**: Desktop-first but mobile-aware for basic viewing
- **Content Density**: High information density while maintaining scannability

### Animations
- **Purposeful Meaning**: Subtle transitions that don't interfere with data analysis workflows
- **Hierarchy of Movement**: Tab transitions, loading states for data fetching, hover feedback on interactive elements
- **Contextual Appropriateness**: Minimal, professional animations that enhance rather than distract

### UI Elements & Component Selection
- **Component Usage**: Tabs for main navigation, Tables for data display, Cards for metric summaries, Badges for status indicators
- **Component Customization**: Tables optimized for dense data display, Cards with consistent spacing
- **Component States**: Clear hover states for interactive elements, loading states for async data
- **Icon Selection**: Professional icons for navigation and status indicators
- **Component Hierarchy**: Primary actions (buttons), secondary info (badges), data containers (tables/cards)
- **Spacing System**: Consistent padding using Tailwind's spacing scale, tighter spacing for data rows
- **Mobile Adaptation**: Horizontal scroll for tables, collapsible sections for mobile viewing

### Visual Consistency Framework
- **Design System Approach**: Component-based design with consistent table and card patterns
- **Style Guide Elements**: Color usage, typography treatment, spacing rules, icon usage
- **Visual Rhythm**: Consistent patterns for data presentation and navigation
- **Brand Alignment**: EVE Online aesthetic while maintaining professional appearance

### Accessibility & Readability
- **Contrast Goal**: WCAG AA compliance minimum, AAA where possible for data-heavy interfaces

## Edge Cases & Problem Scenarios
- **Large Data Sets**: Pagination and virtualization for performance
- **Empty States**: Clear guidance when no data is available
- **Loading States**: Proper feedback during API calls and data fetching
- **Error Handling**: Clear error messages and recovery options

## Implementation Considerations
- **Scalability Needs**: Efficient data handling for large corporations, API rate limiting, caching strategies, and database connection pooling
- **EVE Online ESI Integration**: Proper authentication flow, OAuth token management, error handling, retry logic with exponential backoff, and data synchronization patterns
- **Database Integration**: Connection management, query optimization, data migration strategies, and fallback mechanisms when ESI is unavailable
- **Dual Source Architecture**: Intelligent data source selection (ESI vs Database), cache invalidation strategies, and conflict resolution
- **Real-time Data Management**: Automatic refresh intervals, connection status monitoring, offline capability with database fallback, and transparent data source indicators
- **Data Source Transparency**: Visual badges showing ESI/Database/Cache sources, timestamp display for data freshness, and user-controlled refresh capabilities
- **Testing Focus**: Data accuracy, table performance, tab navigation, API integration reliability, database connection resilience, and fallback behavior
- **Critical Questions**: ESI rate limit handling, database schema design, data synchronization strategies, user session management, authentication security, and graceful degradation when services are unavailable

## Reflection
- This approach focuses on data-driven corporation management while maintaining the professional, space-themed aesthetic that EVE Online players expect
- The dual integration with EVE Online's ESI API and persistent database storage provides both real-time accuracy and historical analysis capabilities
- Intelligent data source selection (ESI → Database → Cache) ensures users always have access to data while optimizing API usage and performance
- Visual transparency about data sources (ESI/Database/Cache indicators) builds user trust and understanding of data freshness
- The tabbed interface allows for comprehensive functionality without overwhelming users
- Emphasis on clear data presentation and efficient workflows aligns with the serious nature of corporation management
- Real-time ESI integration combined with database fallback creates a bridge between in-game activities and strategic planning, making this a mission-critical tool for serious EVE corporations
- Smart caching and refresh strategies balance data freshness with API rate limits and performance considerations