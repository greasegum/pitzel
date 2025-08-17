# Parametric Drawing Editor

A modern parametric drawing editor with real-time collaboration, API integration, and chatbot support.

## 🎯 Features

- **Canvas-based Drawing**: Interactive drawing surface with zoom/pan
- **Real-time Sync**: Event-driven state management with polling fallback
- **API Integration**: RESTful endpoints for external access
- **Chatbot Support**: LLM integration for automated drawing
- **Export/Import**: PNG and JSON formats
- **Responsive Design**: Mobile-friendly interface
- **Persistent Storage**: Automatic save/load functionality

## 🏗️ Architecture

### Core Components

- **`server.js`** - API server with state management
- **`app.js`** - Main frontend application
- **`state-manager.js`** - Central state coordination
- **`api-client.js`** - API communication layer
- **`index.html`** - Main interface
- **`styles.css`** - Styling

### Data Flow

1. **User Action** → `app.js` → `state-manager.js` → `api-client.js` → `server.js`
2. **API Change** → `server.js` → `state-manager.js` (polling) → `app.js` (subscription)
3. **State Update** → All subscribers notified → UI updates automatically

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Open the application**:
   ```
   http://localhost:3001/
   ```

## 📖 Documentation

- [API Documentation](API_DOCUMENTATION.md) - Complete API reference
- [Architecture Guide](ARCHITECTURE.md) - Detailed architecture overview

## 🔧 Development

The codebase follows clean architecture principles:
- **Single Responsibility**: Each file has one clear purpose
- **State Management**: All state changes go through state manager
- **Error Handling**: Graceful fallbacks and user feedback
- **Performance**: Efficient polling and minimal API calls
- **Maintainability**: Clean, documented code

## 📁 File Structure

```
pitzel/
├── server.js              # Main server (API + state management)
├── app.js                 # Main frontend application
├── state-manager.js       # Central state management
├── api-client.js          # API communication layer
├── styles.css             # Styling
├── index.html             # Main HTML interface
├── package.json           # Dependencies
├── persistent_data.json   # Persistent state storage
├── README.md              # This file
├── API_DOCUMENTATION.md   # API reference
└── ARCHITECTURE.md        # Architecture guide
```