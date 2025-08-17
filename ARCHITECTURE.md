# Parametric Drawing Editor - Clean Architecture

## 🎯 Overview
A parametric drawing editor with real-time collaboration, API integration, and chatbot support.

## 🏗️ Architecture

### Core Components

#### 1. **Server (`server.js`)**
- **Purpose**: API server with state management
- **Key Features**:
  - RESTful API endpoints
  - Persistent state management
  - Chatbot integration
  - File export/import
- **State Management**: `EditorStateManager` class
- **Persistence**: JSON file storage

#### 2. **Client (`app.js`)**
- **Purpose**: Main frontend application
- **Key Features**:
  - Canvas-based drawing interface
  - Real-time state synchronization
  - JSON editor integration
  - Tool management
- **State Management**: Central state manager integration
- **UI**: Responsive design with toolbar and panels

#### 3. **State Manager (`state-manager.js`)**
- **Purpose**: Central state coordination
- **Key Features**:
  - Event-driven state updates
  - API synchronization
  - Polling for external changes
  - Subscriber notifications
- **Architecture**: Observer pattern with polling fallback

#### 4. **API Client (`api-client.js`)**
- **Purpose**: API communication layer
- **Key Features**:
  - HTTP request handling
  - Error management
  - Response processing
- **Usage**: Used by state manager and app

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
├── README.md              # Documentation
└── ARCHITECTURE.md        # This file
```

## 🔄 Data Flow

1. **User Action** → `app.js` → `state-manager.js` → `api-client.js` → `server.js`
2. **API Change** → `server.js` → `state-manager.js` (polling) → `app.js` (subscription)
3. **State Update** → All subscribers notified → UI updates automatically

## 🎨 UI Components

- **Canvas**: Drawing surface with zoom/pan
- **Toolbar**: Drawing tools and actions
- **JSON Editor**: Data representation and editing
- **Status Bar**: Entity count and API status
- **Metadata Panel**: Entity properties and constraints

## 🔧 Key Features

- **Real-time Sync**: Event-driven with polling fallback
- **Persistent Storage**: Automatic save/load
- **API Integration**: RESTful endpoints
- **Chatbot Support**: LLM integration
- **Export/Import**: PNG and JSON formats
- **Responsive Design**: Mobile-friendly layout

## 🚀 Development Guidelines

1. **Single Responsibility**: Each file has one clear purpose
2. **State Management**: All state changes go through state manager
3. **Error Handling**: Graceful fallbacks and user feedback
4. **Performance**: Efficient polling and minimal API calls
5. **Maintainability**: Clean, documented code 