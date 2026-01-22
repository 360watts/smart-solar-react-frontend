# Smart Solar Frontend

A React-based dashboard for monitoring and managing the Smart Solar IoT system.

## Features

- **Dashboard**: Real-time overview of device status and telemetry data
- **Device Management**: View and manage registered IoT devices
- **Configuration**: Display gateway configuration and Modbus settings
- **Telemetry**: Advanced data visualization and analytics

## Prerequisites

- Node.js 16+ and npm
- Running Django backend at `http://localhost:8000`

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## API Endpoints

The frontend connects to these Django API endpoints:

- `GET /api/devices/` - List all devices
- `GET /api/config/` - Get gateway configuration
- `GET /api/telemetry/` - Get telemetry data

## Technologies Used

- React 18 with TypeScript
- React Router for navigation
- Recharts for data visualization
- Axios for API calls
- CSS for styling

## Development

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests

## Architecture

The frontend follows a component-based architecture:

- `Dashboard` - Main overview with charts and metrics
- `Devices` - Device management interface
- `Configuration` - Configuration display
- `Telemetry` - Data visualization and analytics
- `Navbar` - Navigation component

All components fetch data from the Django REST API and display it in user-friendly formats.