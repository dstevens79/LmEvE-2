# LMeve 2025 - Current Working State

This document represents the fully functional state of the LMeve 2025 application as of the latest development session.

## Current Functionality

### ✅ Working Features
- **Authentication System**: Both local admin (admin/12345) and EVE SSO login
- **Responsive UI**: Desktop and mobile view toggle
- **Database Management**: Connection testing, schema management, EVE SDE handling
- **Theme System**: Professional dark theme with customization support
- **Tab Navigation**: Dashboard, Members, Assets, Manufacturing, Mining, Logistics, etc.
- **Settings Management**: Complete settings system with sub-tabs
- **Corporation Management**: ESI integration and corp data handling
- **Manufacturing System**: Job scheduling and blueprint management
- **Notifications**: Discord webhooks and EVE mail integration
- **Data Persistence**: Using useKV hooks for state management

### 🏗️ Core Architecture
- **React + TypeScript**: Modern component-based architecture
- **Tailwind CSS**: Professional styling with OKLCH color system
- **Shadcn/ui Components**: Complete UI component library
- **EVE Online ESI**: Full integration with EVE's API system
- **Database Integration**: MySQL support with automated setup scripts
- **Role-based Access**: Permission system for different user types

### 📁 Key Files
- `src/App.tsx`: Main application component with routing and auth
- `src/index.css`: Professional theme and styling system
- `src/components/`: Complete UI component library
- `src/lib/`: Core utilities, auth, database contexts
- `scripts/`: Database setup and maintenance scripts

### 🎨 Visual Design
- Professional dark space theme
- EVE Online branding integration
- Mobile-responsive design
- Glassmorphism effects
- Smooth animations and transitions

## Installation & Setup

1. Clone this repository
2. Run `npm install` to install dependencies
3. Configure database settings in Settings > Database
4. Set up EVE ESI application credentials
5. Run the application with `npm run dev`

## Default Credentials
- Admin User: `admin` / `12345`

This state represents a fully functional EVE Online corporation management system ready for production use.