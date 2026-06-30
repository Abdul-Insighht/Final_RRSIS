# System Architecture Specification: GeoSegAI & Enhanced RRSIS-OT

This document outlines the end-to-end system architecture, design patterns, transactional workflows, and component specifications of the **GeoSegAI** platform and the **Enhanced RRSIS-OT** deep learning inference pipeline.

---

## 1. Architectural Overview & decoulping

GeoSegAI is designed as a modular, three-tier architecture with decoupled visual, business logic, and heavy compute layers. This separation ensures that high-latency PyTorch model inferences do not block user interactions or database state updates.

```
+------------------------------------------------───────────────────────────+
|                           React SPA Frontend                              |
|   - Real-time Firestore subscriptions for real-time state sync            |
|   - Interactive segmentation editor (prompts, raw image, overlay views)   |
|   - Token-based API access via standard HTTPS REST calls                  |
+------------------------------------+--------------------------------------+
                                     | HTTPS REST (JSON / Multipart Form)
                                     ▼
+----------------------------------------------------------------───────────+
|                        Flask REST API Gateway                             |
|   - Token validation via Firebase Admin SDK SDK                           |
|   - Credit validation & transactional Reservation Manager                 |
|   - Code-driven Model Registry & startup Database Auto-Sync               |
+------------------------------------+--------------------------------------+
                                     | PyTorch In-Memory Inference Pipeline
                                     ▼
+----------------------------------------------------------------───────────+
|                       PyTorch Inference Engine                            |
|   - CUDA-accelerated / CPU-fallback inference handlers                    |
|   - Text-guided Dynamic LoRA, Multi-Scale OT & GPG/SAP prompt generation  |
|   - SAM3 image encoder, prompt token encoder, and DETR decoder structures |
+----------------------------------------------------------------───────────+
```

---

## 2. Core Workflow Patterns

### A. Transactional Credit Reservation Pattern (Reserve → Run → Commit/Release)
To prevent race conditions, double-spending, and user over-charging (e.g., if a model crashes during inference), the backend implements a transactional reservation protocol.

```
       [User requests /api/segment]
                    │
                    ▼
       [Starts Firestore Transaction]
                    │
                    ▼
     [Deduct 1 credit & create reservation]
    (Status: 'reserved', expires in 5 mins)
                    │
                    ├──► [Reservation Fails] ──► [Return 402 Insufficient Credits]
                    ▼
      [Execute run_model_inference]
                    │
                    ├──► [Inference Fails]
                    │            │
                    │            ▼
                    │    [Release Reservation] ──► [Re-add 1 credit & set 'released']
                    ▼
      [Inference Succeeds & files saved]
                    │
                    ▼
       [Commit Reservation] ──► [Set 'committed' & create audit log entry]
                    │
                    ▼
       [Return 200 Success Response]
```

1. **Reservation Phase**: When an HTTP POST request hits `/api/segment`, a Firestore transaction is initiated. The service checks the user's credit balance. If balance $\ge 1$, it immediately deducts $1$ credit, updates the user document, and creates a reservation record in the `reservations` collection (status: `reserved`).
2. **Inference Phase**: The Flask thread triggers the PyTorch execution loop.
3. **Execution Fork**:
   * **On Success**: The backend saves the generated masks to the static files directory (`/uploads`). It calls `commit_reservation` which updates the status to `committed` and logs a final audit trail.
   * **On Failure/Timeout**: The backend catches the exception, calls `release_reservation`, which instantly refunds the $1$ credit to the user's profile and updates the reservation record to `released`.

---

### B. Dynamic Model Discovery & Auto-Sync
Models are managed as first-class, code-driven entities.

1. **Local Registry**: In `backend/services/model_registry.py`, models are defined in a centralized dictionary mapping IDs to metadata, weights files, and inference functions.
2. **Start-up Synchronization**: On startup, `app.py` runs `sync_integrated_models_to_firestore()`:
   * It scans the Firestore `models` collection.
   * If a registered model is missing in Firestore, it registers it.
   * If a model is present in Firestore but not in the python registry, it sets its property `isIntegrated = false`.
3. **Frontend React Sync**: The React Client uses Firestore subscriptions (`onSnapshot`) to listen to the `models` collection. The dashboard, dropdown menus, and admin panel update immediately.

---

### C. Image Upload, Processing & Overlay Pipeline
1. **Request Intake**: Incoming satellite/aerial imagery is parsed from multipart form data.
2. **Preprocessing**: The Flask service standardizes the input image by scaling its shortest side, maintaining aspect ratios, and resizing the visual buffer to `504x504` (divisible by 14 to match SAM3 ViT patch size).
3. **Inference & Mask Extraction**: The model outputs logits, which are converted to a binary threshold array (values $> 0.5 \to 1$).
4. **Overlay Generation**:
   * The binary mask is colored (e.g., cyan/red overlay with $40\%$ alpha opacity).
   * The overlay is composite-rendered back onto the source image.
5. **Output Delivery**: The backend returns base64-encoded strings (for immediate browser rendering in React) and saves the files to `/uploads` under unique project-specific names (for persistent cloud access).

---

## 3. Tier Component Specifications

### 🖥️ Frontend (React Vite + Tailwind)
* **`src/context/AuthContext.jsx`**: Manages Firebase User Login, Registration, Google Provider OAuth, and holds current JWT and user profile states.
* **`src/context/ThemeContext.jsx`**: Handles responsive light/dark mode UI tokens.
* **`src/firebase/firestore.js`**: Handles real-time client side data fetching for projects, transaction histories, credit balances, and notification feeds.
* **`src/pages/DashboardPage.jsx`**: Displays overall stats (credits, total segs, model counts) and launches the segmentator interface.
* **`src/pages/NewSegmentationPage.jsx`**: The core interactive UI. Renders original canvas, language prompt input box, loading animations, point annotations, and download buttons.

### ⚙️ Flask API Gateway
* **`backend/app.py`**: Boots the Flask server, registers CORS rules for local and staging client origins, initializes the Firebase Admin SDK, and kicks off database auto-sync.
* **`backend/routes/segmentation.py`**: Implements `/api/segment`. Coordinates credit transaction limits, image format validation, files preservation on disk, and payload generation.
* **`backend/services/reservation_service.py`**: Performs transactional credit reservations using Firestore multi-write transactions.
* **`backend/services/rsotsam3_service.py`**: Exposes the `run_rsotsam3_inference` handler. Manages lazy loading of the weights checkpoints so the Flask process boots quickly.

### 🧠 Deep Learning Pipeline
* **`lib/enhanced_model.py` (Enhanced_RRSIS_UOT)**: The primary coordinator. Standardizes multi-modal inputs, routes textual queries through the text encoder, vision inputs through the vision encoder, and computes segmentation losses.
* **`lib/dynamic_lora.py`**: Modulates vision encoder features by conditioning LoRA adapter weights directly on context vectors generated from the text query.
* **`lib/multiscale_ot_alignment.py` (MultiScaleOTAligner)**: Computes spatial Optimal Transport transport plans between FPN image feature layers and language representation lists to resolve textual coordinates.
* **`lib/prompt_generator.py` (GPG & SAP)**: Takes the computed OT plan, isolates target hot-spots, and dynamically extracts point coordinates (Sparse prompts) based on the target area's scale.

---

## 4. Firestore Database Collections Schema

```
collections/
│
├── users/ (Document: userId)
│   ├── uid: string
│   ├── email: string
│   ├── credits: number
│   ├── role: string ('user' | 'admin')
│   └── createdAt: timestamp
│
├── projects/ (Document: projectId)
│   ├── id: string
│   ├── name: string
│   ├── userId: string
│   ├── query: string
│   ├── model: string
│   ├── originalUrl: string
│   ├── maskUrl: string
│   ├── overlayUrl: string
│   └── createdAt: timestamp
│
├── models/ (Document: modelId)
│   ├── id: string
│   ├── name: string
│   ├── description: string
│   ├── version: string
│   ├── status: string ('enabled' | 'disabled')
│   ├── isIntegrated: boolean
│   └── updatedAt: timestamp
│
└── reservations/ (Document: reservationId)
    ├── id: string
    ├── userId: string
    ├── amount: number
    ├── status: string ('reserved' | 'committed' | 'released' | 'expired')
    ├── expiresAt: timestamp
    ├── createdAt: timestamp
    └── metadata: map
```

---

## 5. Security Rules Configuration (`firestore.rules`)
Authentication and isolation rules prevent cross-tenant reading/writing:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Check if document belongs to authenticated user
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    match /users/{userId} {
      allow read: if isOwner(userId);
      allow write: if false; // Only updated via secure cloud functions/backend
    }

    match /projects/{projectId} {
      allow read, write: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
    }

    match /models/{modelId} {
      allow read: if isAuthenticated();
      allow write: if false; // Only updated by server registry auto-sync
    }
    
    match /reservations/{resId} {
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow write: if false; // Only handled by secure server transactions
    }
  }
}
```
