# Smart Solar React Frontend

A modern React-based dashboard for monitoring and managing the Smart Solar IoT system. Built with TypeScript, React Router, and Recharts for real-time data visualization and device management.

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Development](#development)
- [Component Architecture](#component-architecture)
- [API Integration](#api-integration)
- [Building for Production](#building-for-production)
- [Deployment to Vercel](#deployment-to-vercel)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Project Overview

Smart Solar Frontend is a comprehensive dashboard for IoT solar energy system monitoring and management. It provides:

- **Real-time Dashboard**: Live visualization of device status and metrics
- **Device Management**: Register, configure, and manage IoT devices
- **Telemetry Visualization**: Interactive charts for power, voltage, and energy data
- **Alert System**: Real-time notifications and alert management
- **User Authentication**: Secure login with JWT token management
- **Responsive Design**: Mobile-friendly interface supporting all devices
- **Role-Based Access**: Admin, staff, and user interfaces

The frontend communicates with the Django REST API backend via secure HTTPS connections with JWT authentication.

## Features

### Dashboard
- ✅ Real-time device status overview
- ✅ Summary metrics (total power, energy, devices online)
- ✅ Interactive charts for telemetry data
- ✅ Alert notifications
- ✅ Device health status indicators

### Device Management
- ✅ List all registered devices
- ✅ View device details and specifications
- ✅ Create and register new devices
- ✅ Device configuration management
- ✅ Device status monitoring
- ✅ Firmware version tracking

### Configuration
- ✅ Display gateway configuration
- ✅ Modbus settings management
- ✅ System parameters
- ✅ Admin configuration panel

### Telemetry & Analytics
- ✅ Historical data visualization
- ✅ Interactive charts (line, bar, area graphs)
- ✅ Power generation trends
- ✅ Energy accumulation tracking
- ✅ Temperature monitoring
- ✅ Data filtering and date range selection

### User Management
- ✅ User authentication (login/logout)
- ✅ User profile management
- ✅ Password change functionality
- ✅ Role-based navigation (Admin/Staff/User)

### Alerts
- ✅ Alert notifications
- ✅ Alert history
- ✅ Alert severity indicators
- ✅ Alert resolution tracking

## Technology Stack

### Core Framework
- **React 18.3.1**: UI library with hooks
- **TypeScript 5.5.4**: Type-safe JavaScript
- **Vite 5.1.7**: Fast build tool and dev server

### Routing & State Management
- **React Router 6.21.3**: Client-side routing
- **Context API**: Global state management (user, auth)

### UI Components & Styling
- **CSS**: Custom CSS with responsive design
- **CSS Modules**: Component-scoped styling (optional)
- **Responsive Grid**: Mobile-first responsive layout

### Data Visualization
- **Recharts 2.10.3**: React charting library
- **Interactive Charts**: Line, bar, area, and pie charts
- **Real-time Updates**: Auto-refresh capabilities

### HTTP & API Communication
- **Axios 1.6.5**: HTTP client library
- **Interceptors**: For authentication headers
- **Error Handling**: Centralized API error management

### Development Tools
- **ESLint**: Code quality and formatting
- **npm/yarn**: Package management
- **VS Code**: Recommended IDE

## Prerequisites

### System Requirements
- Node.js 16+ (tested with Node 18+)
- npm 8+ or yarn 1.22+
- Git
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Backend Requirements
- Running Django backend API (local or remote)
- Valid backend URL (e.g., `http://localhost:8000/api`)
- Proper CORS configuration on backend

## Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd smart-solar-workspace/smart-solar-react-frontend
```

### 2. Install Dependencies

Using npm:
```bash
npm install
```

Using yarn:
```bash
yarn install
```

This installs:
- React and React Router
- TypeScript
- Vite and build tools
- Recharts for visualization
- Axios for API calls
- ESLint for code quality

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

**Development:**
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_APP_NAME=Smart Solar
```

**Production (Vercel):**
```env
VITE_API_BASE_URL=https://your-backend-api.vercel.app/api
VITE_APP_NAME=Smart Solar
```

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173` by default.

### 5. Verify Backend Connection

After startup, the app will attempt to connect to the backend API. Check the browser console for:

```
✅ Connected to API: http://localhost:8000/api
```

If you see errors, verify:
1. Backend is running
2. `VITE_API_BASE_URL` is correct
3. Backend CORS is configured for your frontend URL

## Development

### Available Scripts

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run linter
npm run lint

# Format code (if prettier configured)
npm run format

# Type checking
npm run type-check
```

### Development Workflow

1. **Start Backend**:
   ```bash
   cd ../smart-solar-django-backend
   python manage.py runserver
   ```

2. **Start Frontend** (in separate terminal):
   ```bash
   cd ../smart-solar-react-frontend
   npm run dev
   ```

3. **Access Application**:
   - Open `http://localhost:5173`
   - Login with test credentials
   - Interact with dashboard

### Code Structure

```
src/
├── components/          # React components
│   ├── AdminRoute.tsx  # Route guard for admin access
│   ├── Alerts.tsx      # Alert management component
│   ├── Configuration.tsx # Configuration settings
│   ├── Dashboard.tsx    # Main dashboard view
│   ├── DevicePresets.tsx # Device presets
│   ├── Devices.tsx      # Device list and management
│   ├── Employees.tsx    # Staff management (admin)
│   ├── Login.tsx        # Login page
│   ├── Navbar.tsx       # Navigation bar
│   └── ...
├── contexts/            # React Context for state
│   ├── AuthContext.tsx  # Authentication state
│   └── ...
├── services/            # API services
│   └── api.ts          # HTTP client and API calls
├── App.tsx             # Main app component
├── App.css             # Global styles
├── index.css           # Base styles
└── main.tsx            # Entry point
```

## Component Architecture

### Core Components

#### Login.tsx
- **Purpose**: User authentication
- **Props**: None (uses AuthContext)
- **Features**:
  - Email/password input
  - Form validation
  - Error handling
  - Remember me option
- **Navigation**: Redirects to dashboard on success

#### Dashboard.tsx
- **Purpose**: Main overview and monitoring
- **Props**: None (uses AuthContext)
- **Features**:
  - Summary metrics
  - Device status overview
  - Telemetry charts
  - Alert notifications
  - Real-time updates
- **API Calls**: `/devices/`, `/telemetry/`, `/alerts/`

#### Devices.tsx
- **Purpose**: Device list and management
- **Props**: None (uses AuthContext)
- **Features**:
  - Device list with pagination
  - Create new device
  - Edit device details
  - Delete device
  - Device status indicators
- **API Calls**: `/devices/`, `/devices/{id}/`

#### Configuration.tsx
- **Purpose**: System and device configuration
- **Props**: None (uses AuthContext)
- **Features**:
  - Display gateway config
  - Edit Modbus settings
  - System parameters
  - Save configurations
- **API Calls**: `/config/`, `/config/gateway/`

#### Alerts.tsx
- **Purpose**: Alert management and notifications
- **Props**: None (uses AuthContext)
- **Features**:
  - Alert list with filtering
  - Alert details modal
  - Mark as resolved
  - Severity indicators
  - Auto-refresh
- **API Calls**: `/alerts/`, `/alerts/{id}/`

#### Navbar.tsx
- **Purpose**: Navigation and user menu
- **Props**: None (uses AuthContext)
- **Features**:
  - Navigation links
  - User profile menu
  - Logout functionality
  - Role-based menu items
- **State**: Active route highlighting

#### AdminRoute.tsx
- **Purpose**: Route protection for admin endpoints
- **Props**: Route component
- **Features**:
  - Check user role (staff/admin)
  - Redirect to dashboard if unauthorized
  - Loading state during verification

### State Management

#### AuthContext
```typescript
interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
}
```

## API Integration

### HTTP Client Setup

The `api.ts` service handles all backend communication:

```typescript
// src/services/api.ts
- Axios instance with base URL
- Authentication header interceptor
- Error handling middleware
- Token refresh on 401
- Request/response logging
```

### Authentication Flow

1. **Login Request**:
   ```javascript
   POST /auth/login/
   { "email": "user@example.com", "password": "password" }
   ```

2. **Token Response**:
   ```javascript
   {
     "access": "eyJhbGciOiJIUzI1NiIs...",
     "refresh": "eyJhbGciOiJIUzI1NiIs...",
     "user": { "id": 1, "email": "user@example.com" }
   }
   ```

3. **Token Storage**:
   - `access` token: localStorage (JSON.stringify)
   - Used in subsequent requests: `Authorization: Bearer <token>`

4. **Token Refresh**:
   - Automatic on 401 response
   - Uses `refresh` token
   - Updates stored `access` token

### API Endpoints Used

| Endpoint | Method | Used By | Purpose |
|----------|--------|---------|---------|
| `/auth/login/` | POST | Login | Authenticate user |
| `/auth/register/` | POST | Login | Create account |
| `/auth/logout/` | POST | Navbar | Logout user |
| `/auth/user/` | GET | Dashboard | Get current user |
| `/auth/profile/` | GET/PUT | Profile | User profile data |
| `/devices/` | GET/POST | Devices | List/create devices |
| `/devices/{id}/` | GET/PUT/DELETE | Devices | Device operations |
| `/telemetry/` | GET | Dashboard | Telemetry data |
| `/telemetry/{id}/` | GET | Telemetry | Specific telemetry |
| `/config/` | GET/PUT | Configuration | System config |
| `/alerts/` | GET/POST | Alerts | Alert list |
| `/alerts/{id}/` | GET/PUT | Alerts | Alert operations |

### Error Handling

The API service handles:

```javascript
// 401 - Token expired/invalid → Refresh or redirect to login
// 403 - Permission denied → Show error message
// 404 - Resource not found → Navigate away or show error
// 500 - Server error → Show error notification
// Network error → Retry or show offline message
```

## Building for Production

### Create Optimized Build

```bash
npm run build
```

This creates:
- `dist/` directory with optimized files
- Minified and bundled JavaScript
- Optimized CSS and assets
- Source maps (optional)

### Preview Production Build

Test the production build locally:

```bash
npm run preview
```

Then open `http://localhost:4173` to see the built version.

### Build Output

```
dist/
├── index.html           # Main entry point
├── assets/
│   ├── index-<hash>.js  # Bundled JavaScript
│   ├── index-<hash>.css # Bundled CSS
│   └── ...              # Other assets
└── vite.svg             # Static assets
```

## Deployment to Vercel

### Option 1: Connect GitHub (Recommended)

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Deploy to Vercel"
   git push origin main
   ```

2. **Connect Repository**:
   - Go to vercel.com
   - Click "New Project"
   - Select your GitHub repository
   - Select `smart-solar-react-frontend` folder
   - Click "Deploy"

3. **Configure Environment Variables**:
   - Go to Settings → Environment Variables
   - Add `VITE_API_BASE_URL`: Your production backend URL
   - Save settings

4. **Automatic Deployment**:
   - Every push to main triggers automatic build
   - Vercel handles building and deployment
   - Staging URLs available for PRs

### Option 2: Manual Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

3. **Configure Environment** when prompted:
   - Set environment variables
   - Select deployment settings

### Post-Deployment Steps

1. **Verify Deployment**:
   ```bash
   # Visit the Vercel URL provided
   https://your-project-name.vercel.app
   ```

2. **Configure Backend CORS**:
   - Update Django backend CORS_ALLOWED_ORIGINS
   - Add your Vercel domain: `https://your-project-name.vercel.app`
   - Redeploy backend if needed

3. **SSL Certificate**:
   - Vercel automatically provides SSL
   - All traffic is HTTPS

### Performance Optimization

Vercel provides:
- Global CDN for static assets
- Automatic image optimization
- Compression and minification
- Caching optimization
- Analytics dashboard

## Environment Variables

### Development

Create `.env.local`:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:8000/api

# App Information
VITE_APP_NAME=Smart Solar

# Optional: Debug Mode
VITE_DEBUG=true
```

### Production

Set in Vercel Dashboard → Settings → Environment Variables:

```env
VITE_API_BASE_URL=https://your-backend-api.vercel.app/api
VITE_APP_NAME=Smart Solar
VITE_DEBUG=false
```

### Accessing Environment Variables in Code

```typescript
// Vite environment variables must be prefixed with VITE_
const apiBase = import.meta.env.VITE_API_BASE_URL;
const appName = import.meta.env.VITE_APP_NAME;
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;
```

## Troubleshooting

### Common Issues

**Issue: "Cannot connect to backend API"**
```
Solution:
1. Verify backend is running: curl http://localhost:8000/api/health/
2. Check VITE_API_BASE_URL in .env.local
3. Check browser console for CORS errors
4. Ensure backend CORS_ALLOWED_ORIGINS includes your frontend URL
```

**Issue: "Login page shows but can't submit form"**
```
Solution:
1. Check network tab for API errors
2. Verify backend is accepting requests
3. Check if JWT token generation is working
4. Look for error messages in browser console
```

**Issue: "Charts not displaying data"**
```
Solution:
1. Check if telemetry data exists in backend database
2. Verify API call is successful (network tab)
3. Check data format matches Recharts requirements
4. Enable debug mode: VITE_DEBUG=true
```

**Issue: "Token expired/401 errors"**
```
Solution:
1. Logout and login again
2. Check token refresh is working in network tab
3. Verify JWT_SECRET_KEY matches backend
4. Check token expiration time in backend
```

**Issue: "CORS error on localhost"**
```
Solution:
1. In backend .env, add: CORS_ALLOWED_ORIGINS=http://localhost:5173
2. Restart Django server
3. Clear browser cache
4. Check browser console for full error details
```

**Issue: "Build fails with TypeScript errors"**
```
Solution:
1. Run type check: npm run type-check
2. Fix reported TypeScript issues
3. Verify all imports are correct
4. Check for missing type definitions
```

### Debug Mode

Enable detailed logging:

```typescript
// In src/main.tsx or any component
if (import.meta.env.VITE_DEBUG === 'true') {
  console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);
  console.log('Environment:', import.meta.env.MODE);
}
```

### Browser DevTools

1. **Network Tab**: Monitor API requests and responses
2. **Console Tab**: Check for JavaScript errors
3. **Application Tab**: View localStorage for JWT tokens
4. **React DevTools**: Inspect component hierarchy and props

### Server Connection Test

```bash
# Test backend connectivity
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/health/

# Expected response:
# {"status": "healthy", "timestamp": "..."}
```

## Contributing

### Code Standards

- Follow TypeScript/JavaScript best practices
- Use meaningful component and function names
- Add JSDoc comments for complex logic
- Keep components focused and reusable
- Maintain consistent code formatting

### Testing Components

```typescript
// Example component testing pattern
import { render, screen } from '@testing-library/react';
import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  test('renders dashboard title', () => {
    render(<Dashboard />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
```

### Git Workflow

1. Create feature branch: `git checkout -b feature/description`
2. Make changes with clear commits
3. Test thoroughly
4. Push branch: `git push origin feature/description`
5. Create Pull Request with description

### Commit Message Format

```
feat: Add new device listing feature
^--^  ^------------------------^
|     |
|     +-> Summary in present tense
|
+-------> Type: feat, fix, docs, style, refactor, test
```

### Pull Request Checklist

- [ ] Code passes linter (`npm run lint`)
- [ ] TypeScript has no errors
- [ ] Component tested in browser
- [ ] Backend API is functioning
- [ ] Responsive design verified
- [ ] Commit messages are clear
- [ ] No console errors or warnings

## Additional Resources

### Documentation
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Vite Guide](https://vitejs.dev/guide)
- [Recharts Examples](https://recharts.org/examples)
- [React Router Documentation](https://reactrouter.com)

### Backend Integration
- [Django REST API](../smart-solar-django-backend/README.md)
- [API Endpoints Documentation](../smart-solar-django-backend/ENDPOINT_SECURITY.md)
- [Security Architecture](../smart-solar-django-backend/SECURITY_REVIEW.md)

### Deployment
- [Vercel Documentation](https://vercel.com/docs)
- [Environment Variables Guide](https://vercel.com/docs/concepts/projects/environment-variables)
- [Performance Optimization](https://vercel.com/docs/concepts/performance/overview)