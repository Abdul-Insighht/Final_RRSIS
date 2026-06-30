# Web Application Codebase Specification: GeoSegAI (RRSIS-WebApp)

This document provides a comprehensive, file-by-file specification of the **GeoSegAI Web Application** (`RRSIS-WebApp`). It describes the components, routes, services, contexts, page layouts, database hooks, and APIs that make up the React Client Frontend and the Flask REST API Backend. It excludes the model training and evaluation codebases, focusing purely on application logic.

---

## 🏛️ Application Design Architecture
The web application is structured into two main components:
1. **Frontend (`src/`)**: A single-page React application compiled using Vite and styled with TailwindCSS, connecting to Google Firebase for client-side Auth and real-time Firestore database queries.
2. **Backend (`backend/`)**: A Python Flask REST API server acting as a controller. It secures routes, verifies user tokens, executes database-wrapped credit transactions, coordinates local PyTorch model inferences, and handles file uploads.

---

## 🖥️ Frontend (React Client) Codebase

### A. Context Providers (`src/context/`)
Context providers handle global app state, eliminating prop-drilling across layouts:
* **`AuthContext.jsx`**: Initializes the Firebase Client SDK Auth layer. Exposes functions for Email/Password sign-up, sign-in, password resets, Google OAuth login (`GoogleAuthProvider`), email verification tracking, and maintains the current user object.
* **`AdminAuthContext.jsx`**: Handles administrator dashboard sessions. Verifies admin login status and caches administration session tokens in `localStorage`.
* **`NotificationContext.jsx`**: Subscribes to real-time updates from the user's `notifications` sub-collection in Firestore, streaming logs (e.g. credit updates, transaction status) directly into the UI.
* **`ThemeContext.jsx`**: Manages light/dark mode UI configurations by injecting CSS classes into the document root.

### B. Pages (`src/pages/`)
* **`LandingPage.jsx`**: The portal entry point. Displays product features, model benchmarks, sample remote sensing images, and call-to-action buttons.
* **`LoginPage.jsx` & `SignUpPage.jsx`**: User onboarding interfaces. Hook into validation functions and AuthContext triggers.
* **`DashboardPage.jsx`**: The main user portal. Integrates real-time widgets showing credit balance, operations count, recent segmentation logs, and system announcements.
* **`NewSegmentationPage.jsx`**: The core playground interface. Provides:
  * Drag-and-drop satellite image upload area.
  * Natural language query text-box.
  * Model selector dropdown.
  * Real-time loading progress animation.
  * Side-by-side canvas: Original canvas, binary segmentation mask layer, and translucent mask overlay composite layer.
* **`ProjectsPage.jsx` & `ProjectDetailPage.jsx`**: List and detail interfaces for exploring historical projects, downloading segmented masks, and re-running queries.
* **`BillingPage.jsx`**: Exposes credit purchase tiers. Triggers the credit checkouts modal and lists audit transaction logs.
* **`admin/AdminDashboardPage.jsx`**: Global metrics dashboard for admins showing total user registry count, credit reservation logs, active backend models, and system status metrics.
* **`admin/UserManagementPage.jsx`**: Allows administrators to view all registered user accounts, search/filter profiles, and adjust credit balances.
* **`admin/ModelManagementPage.jsx`**: Allows admins to inspect the sync state of backend deep learning models, review performance metrics, and toggle integrations.
* **`admin/APIKeyManagementPage.jsx` & `admin/ActivityMonitoringPage.jsx`**: Interfaces for administrative key control and query activity logging.

### C. Components (`src/components/`)
* **`common/Sidebar.jsx`**: Renders standard user navigation links, current user profile badge, and responsive toggle buttons.
* **`common/Header.jsx`**: Holds page titles, theme toggle icon, and links the Notification feed dropdown.
* **`common/NotificationDropdown.jsx`**: An interactive overlay displaying a user's notification logs.
* **`common/PaymentModal.jsx`**: Renders mock checkout layouts for purchase transactions.
* **`admin/AdminSidebar.jsx`**: A dedicated sidebar with links to administrative tools.

---

## ⚙️ Backend (Flask REST API) Codebase

### A. Core Configuration (`backend/`)
* **`app.py`**: The bootstrap manager. Initializes Flask, activates CORS origins, runs the Firebase Admin SDK connection, registers the blueprints (API endpoints), and calls the database startup auto-sync.
* **`config.py`**: Declares environment parameters (secret keys, JWT token values, CORS permissions, maximum file limits, upload folders).

### B. Service Layer (`backend/services/`)
* **`auth_service.py` & `admin_auth_service.py`**: Implements middleware decorators (e.g. `@token_required`, `@admin_required`) to secure REST API routes. Decode and verify Firebase credentials using the Firebase Admin SDK.
* **`reservation_service.py`**: Implements the transactional **Credit Reservation Pattern** (`reserve_credits`, `commit_reservation`, `release_reservation`). Deducts credits and locks them in Firestore before running models to prevent race conditions or balance issues.
* **`credit_service.py`**: Directly adds or deducts user credits.
* **`model_registry.py`**: A code-driven registry. Defines metadata for CADFormer and RS-OT-SAM3 models and routes queries to their execution handlers. Auto-syncs definitions to Firestore on server boot.
* **`cadformer_service.py` & `rsotsam3_service.py`**: Inference wrappers that lazy-load deep learning model classes and checkpoint weights, run inputs through PyTorch forward passes, extract binary masks, and compile image overlays.

### C. Blueprints / Routing Gateway (`backend/routes/`)
* **`segmentation.py`**: Exposes `POST /api/segment`. Accepts image uploads, parses textual queries, secures transactional credit locks, triggers model inferences, saves images to `/uploads/`, updates project records, and returns JSON payloads.
* **`payments.py`**: Exposes routes for credit transactions (package checkouts, invoice audit logging).
* **`admin_auth.py` & `admin_users.py`**: Exposes secure administrative pathways to inspect users and adjust credit balances.
* **`admin_models.py` & `admin_system.py`**: Provides endpoints for model diagnostics, activation controls, and system parameters.
