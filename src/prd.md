# LMeve - EVE Online Corporation Management Tool

## Core Purpose & Success
- **Mission Statement**: A modern web-based corporation management tool for EVE Online that helps CEOs and directors manage member assets, manufacturing, mining operations, and corporation logistics efficiently.
- **Success Indicators**: Reduced time spent on manual corporation management tasks, improved member engagement tracking, streamlined asset and production oversight.
- **Experience Qualities**: Professional, efficient, comprehensive - feels like a serious business management tool for virtual corporations.

## Project Classification & Approach
- **Complexity Level**: Complex Application (advanced functionality, multiple data views, corporation management features)
- **Primary User Activity**: Managing - CEOs and directors actively managing corporation operations, tracking member activities, and making strategic decisions.

## Thought Process for Feature Selection
- **Core Problem Analysis**: EVE Online corporations need comprehensive tools to track member assets, manufacturing operations, mining activities, and overall corp logistics beyond what the game provides natively.
- **User Context**: Corporation leaders using this tool during strategic planning sessions, regular check-ins, and operational oversight meetings.
- **Critical Path**: Login → Dashboard Overview → Drill into specific management areas (Members, Assets, Manufacturing, etc.) → Take action or generate reports.
- **Key Moments**: Quick dashboard overview, detailed member asset analysis, manufacturing pipeline monitoring.

## Essential Features
- **Tabbed Interface**: Core navigation between different management areas (Members, Assets, Manufacturing, Mining, Logistics, etc.)
- **EVE Online API Integration**: Real-time data synchronization with EVE Online's ESI API for live corporation data
- **Real-time Data Dashboard**: Live connection status, API health monitoring, and automatic data refresh capabilities
- **Member Management**: Track corporation members, their assets, activities, and contributions
- **Asset Tracking**: Monitor corporation and member assets across different locations and types with live EVE data
- **Manufacturing Job Scheduling**: Real-time tracking of active manufacturing jobs with progress monitoring, pause/resume capabilities, and completion alerts
- **Blueprint Management**: Comprehensive blueprint library with research levels, material efficiency tracking, and production planning
- **Production Planning**: Advanced planning tools for creating production schedules, cost analysis, and profit estimation
- **Material Requirements Planning**: Automatic calculation of material needs for manufacturing jobs with availability tracking
- **Mining Operations**: Monitor mining activities, ore processing, and resource allocation
- **Corporation Projects**: Define project hangars for material deliveries, track requirements via ESI asset and container log endpoints, match deliveries to project needs, and monitor progress with real-time hangar scanning
- **Settings & Configuration**: Comprehensive settings panel for API key management, sync preferences, and notification controls
- **Dashboard Overview**: Quick stats and alerts for corporation health and activity with live EVE Online connection status

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
- **Scalability Needs**: Efficient data handling for large corporations, API rate limiting, and caching strategies
- **EVE Online API Integration**: Proper authentication flow, error handling, and data synchronization patterns
- **Real-time Data Management**: Automatic refresh intervals, connection status monitoring, and offline capability
- **Testing Focus**: Data accuracy, table performance, tab navigation, API integration reliability
- **Critical Questions**: API integration patterns, data refresh strategies, user session management, authentication security

## Reflection
- This approach focuses on data-driven corporation management while maintaining the professional, space-themed aesthetic that EVE Online players expect
- The integration with EVE Online's ESI API provides real-time data that makes the tool truly valuable for active corporation management
- The tabbed interface allows for comprehensive functionality without overwhelming users
- Emphasis on clear data presentation and efficient workflows aligns with the serious nature of corporation management
- Real-time API integration creates a bridge between in-game activities and strategic planning, making this a mission-critical tool for serious EVE corporations