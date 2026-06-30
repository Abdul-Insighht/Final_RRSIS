# User-Interactive Lifecycle & Web App Architecture Details

This document maps the complete request-execution lifecycle of the GeoSegAI platform. It illustrates the workflow from the moment a user uploads an image and submits a query, through the frontend, database transaction, API controller, deep learning model layers, and back to the user interface.

---

## 🏛️ Comprehensive Architecture & Flow Blueprint

```
                             ┌───────────────────────────────────────┐
                             │       USER INPUTS & INTERACTION       │
                             │  - Raw Satellite Image (PNG/JPG)      │
                             │  - Natural Language Text Query        │
                             └───────────────────┬───────────────────┘
                                                 │
                                                 │ Upload & Dispatched Payload
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               React Frontend Client (Vite)                             │
│  - Captures inputs, initiates project document state as "pending" in Firestore         │
│  - Sends Multipart Form data to Flask and subscribes to Firestore real-time snapshots  │
└────────────────────────────────────────────────┬───────────────────────────────────────┘
                                                 │
                                                 │ HTTPS POST /api/segment
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Firestore Database Gate                                   │
│  - Atomically reserves 1 credit from user profile before executing model inference      │
│  - Aborts request if balance < 1 credit; releases lock back on model error            │
└────────────────────────────────────────────────┬───────────────────────────────────────┘
                                                 │
                                                 │ Verified Transaction Tokens
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Flask API Backend Controller                              │
│  - Decodes authentication tokens, triggers dynamic routing via Model Registry          │
│  - Allocates request to PyTorch inference services (lazy weights load & VRAM copy)     │
└────────────────────────────────────────────────┬───────────────────────────────────────┘
                                                 │
                                                 │ PyTorch Tensors
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       PyTorch Deep Learning Engine (Inference)                         │
│                                                                                        │
│   1. [Multi-Modal Encoding]   Tokenizes query (BERT), resizes image (504x504)          │
│   2. [Dynamic LoRA Adapter]   Modulates ViT vision attention based on query context    │
│   3. [Multi-Scale OT Aligner] Computes Sinkhorn transport plans matching text to pixels│
│   4. [GPG & SAP Generator]    Generates point coordinates based on target footprint    │
│   5. [SAM3 Segment Decoder]   Decodes visual boundary masks from image & point prompts │
└────────────────────────────────────────────────┬───────────────────────────────────────┘
                                                 │
                                                 │ Logits & Segmentation Masks
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                         Post-Processing & Storage Layer                                │
│  - Sigmoid thresholding transforms outputs into binary segmentation masks              │
│  - Combines mask with original image to draw a 40% transparent colored overlay         │
│  - Saves raw, mask, and overlay files to static storage path: backend/uploads/        │
└────────────────────────────────────────────────┬───────────────────────────────────────┘
                                                 │
                                                 │ File URLs & Completed Status
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                         Firestore Committal & Status Sync                             │
│  - Commits credit deduction transaction permanently; saves file URLs in project doc   │
│  - Switches project document status from "pending" to "completed"                      │
└────────────────────────────────────────────────┬───────────────────────────────────────┘
                                                 │
                                                 │ Real-time Collection Snapshot Sync
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              React Client SPA Result Render                            │
│  - Instantly detects status change to "completed" via open database sockets            │
│  - Replaces loading spinner with interactive masks & overlay composite viewports       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📝 Step-by-Step Architecture Process Description

### 1. User Inputs Capture
* **Action**: A user starts the process by uploading a raw satellite/aerial image and entering a descriptive text prompt (e.g. *"the circular white fuel storage tank near the harbor"*).
* **Objective**: Define the exact spatial targets and details to guide the segmentation model boundaries.

### 2. Frontend State Initialization & Dispatch
* **Local State**: The React frontend creates a project document in Firestore, labeling its status as `pending` to show a loading/processing spinner in the browser.
* **API Delivery**: The frontend bundles the binary image and text values into a `Multipart/Form-Data` HTTP payload and dispatches it via a POST request to `/api/segment`.

### 3. Firestore Transaction Gate (Credit Guard)
* **Pre-check**: The server contacts Firestore inside an isolated database transaction to check the user's credits.
* **Reservation Lock**: If credits are available, $1$ credit is reserved and subtracted immediately to prevent duplicate requests. If the credit balance is zero, the transaction is rejected, halting model inference.

### 4. API Controller & Model Routing
* **Token Verification**: The Flask backend decodes the secure token using the Firebase Admin SDK.
* **Weights Check**: It checks `model_registry.py`. If this is the first execution, it lazy-loads model weights (such as `sam3.pt` and `best_model.pth`) into RAM/GPU VRAM.
* **Payload Hand-off**: Preprocesses the image tensor to standard dimensions ($504 \times 504$) and forwards it to the PyTorch instance.

### 5. PyTorch Core DL Inference
* **Dynamic LoRA**: Attaches text context vectors directly into the Vision Transformer (ViT) attention adapters, priming the network to look for objects related to the keywords.
* **Multi-Scale Optimal Transport (OT)**: Visual features from different FPN levels are mapped to text embeddings via the Sinkhorn matching algorithm, creating a joint V-L transport alignment map.
* **Prompt Extraction**: Grounding-Aware Prompt Generator (GPG) scans the alignment map, and Scale-Aware Prompting (SAP) dynamically decides how many point prompts (coordinates) to extract based on the target object's size.
* **Mask Decoding**: The SAM3 segment decoder takes the FPN features and point prompts to output boundary mask logits.

### 6. Post-Processing & Disk Sync
* **Binarization**: Converts logits to a binary mask using a $0.5$ confidence threshold.
* **Overlay Generation**: Blends the segmentation mask as a semi-transparent colored overlay back onto the original image.
* **Asset Saving**: Saves the raw image, mask, and overlay files into `backend/uploads/` using unique names (containing the project ID and a random hash) to prevent caching problems.

### 7. Database Committal & Sync
* **State Updates**: The backend writes the final URLs (e.g. `/uploads/<project_id>_<hash>_overlay.png`) to the project document in Firestore and sets its status to `completed`.
* **Deduction Finalization**: Confirms the credit transaction permanently in the reservations audit feed.

### 8. Frontend React Render
* **Instant Detection**: The React frontend receives the Firestore status transition (`completed`) via real-time WebSocket listeners (`onSnapshot`).
* **Visual Update**: The UI hides the loading screen and renders the interactive viewport, allowing the user to view the segmented overlay, toggle the mask layout, and inspect metrics.
