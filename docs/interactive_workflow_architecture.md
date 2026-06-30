# Interactive Request Lifecycle & Architecture Flow: End-to-End RRSIS Execution

This document provides a step-by-step architectural breakdown of what happens when a user uploads an image, inputs a text query, and executes Referring Remote Sensing Image Segmentation (RRSIS) in the GeoSegAI platform. It maps the end-to-end data lifecycle from the browser client, through the credit management gate, into the deep learning pipeline, and back to the user interface.

---

## 🗺️ Architectural Flow Chart

```
+───────────────────────────+
| 1. User Inputs UI Query   |  <--- React Client SPA
|    Image & Text Prompt    |
+─────────────┬─────────────+
              │ Multipart Form Payload
              ▼
+───────────────────────────+
| 2. API Gateway Receives   |  <--- Flask Backend
|    Validation & Lock      |
+─────────────┬─────────────+
              │ Transactions collection lock
              ▼
+───────────────────────────+
| 3. Credit Reservation      |  <--- Firestore (1 credit lock)
|    Checks & Deducts       |
+─────────────┬─────────────+
              │ In-memory model routing
              ▼
+───────────────────────────+
| 4. Text & Image Encoding  |  <--- PyTorch Core (Swin-BERT / ViT)
|    Tokenization & FPN     |
+─────────────┬─────────────+
              │ Conditioned feature map
              ▼
+───────────────────────────+
| 5. Multi-Scale OT Align   |  <--- Sinkhorn Matching Loop
|    Visual-Textual Mapping |
+─────────────┬─────────────+
              │ Transport plan P (B, HW, seq)
              ▼
+───────────────────────────+
| 6. GPG & SAP Prompt Gen   |  <--- Point Prompts (B, K, 2)
|    Dynamic scale points   |
+─────────────┬─────────────+
              │ Coordinates & labels
              ▼
+───────────────────────────+
| 7. SAM3 Mask Decoding    |  <--- ViT boundary projection
|    DETR Hypotheses        |
+─────────────┬─────────────+
              │ Predicted logits & scores
              ▼
+───────────────────────────+
| 8. Post-Processing        |  <--- Mask Compositing & Alpha overlays
|    Save files & URLs      |
+─────────────┬─────────────+
              │ Disk write to /uploads
              ▼
+───────────────────────────+
| 9. Commit transaction     |  <--- Firestore update & audit logs
|    Project set COMPLETED  |
+─────────────┬─────────────+
              │ Real-time DB notification subscription
              ▼
+───────────────────────────+
| 10. UI Update & Render    |  <--- React Client transitions state
|     Mask/Overlay display  |
+───────────────────────────+
```

---

## 📑 Detailed Request Lifecycle Walkthrough

### Step 1: Frontend Input Capture (React SPA Client)
1. **User Action**: The user opens the GeoSegAI portal, enters a project workspace, uploads a high-resolution satellite image, and inputs a referring query (e.g., *"the oval stadium next to the main runway"*).
2. **State Creation**: The React application creates a new database document inside the `projects` collection in Firestore with a status of `pending`.
3. **Payload Dispatch**: React bundles the raw image file (as a binary blob) and the metadata fields (query text, model ID, user ID, project ID) into a standard HTML5 `Multipart/Form-Data` object and shoots it via an HTTP POST request to the backend endpoint:
   `POST http://localhost:5000/api/segment`

---

### Step 2: Security Validation & Request Parser (Flask API)
1. **Token Authentication**: The request headers are checked for authentication tokens. The Flask app verifies the caller's identity against the Firebase Admin Auth SDK.
2. **Payload Parsing**: The Flask route parser isolates the binary image buffer, the text query string, and the target model ID (e.g., `rs-ot-sam3`).

---

### Step 3: Transactional Credit Lock (Firestore Transaction Gate)
1. **Reservation Request**: To prevent user credit exploitation or loss due to server-side crashes during heavy computation, the backend invokes `reserve_credits()`.
2. **Atomic Transaction**: Firestore locks the user’s database document:
   * **Sufficient Balance**: If the user has $\ge 1$ credit, the backend immediately subtracts $1$ credit and creates a `reservation` entry with status `reserved`.
   * **Insufficient Balance**: The transaction aborts and returns an HTTP `402 Payment Required` code to the frontend immediately.

---

### Step 4: Multi-Modal Ingestion & Backbone Prep (Deep Learning In-Memory)
1. **Model Routing**: The Flask app routes the request payload through the `MODEL_REGISTRY` mapping to trigger the `rs-ot-sam3` execution module.
2. **Image Preprocessing**: The raw image bytes are loaded using PIL, resized to $504 \times 504$ pixels, normalized to the range $[-1, 1]$, and converted into a PyTorch tensor on the target device (CUDA or CPU).
3. **Text Tokenization**: The referring text is tokenized into wordpiece vectors (maximum length of 32 tokens) matching SAM3's internal vocabulary rules.

---

### Step 5: Visual-Textual Core Fusion (Dynamic LoRA & Multi-Scale OT)
1. **Language Encoding**: The SAM3 text encoder processes the tokenized query, yielding language embedding vectors.
2. **Text-Guided Dynamic LoRA**:
   * The text feature vectors are pooled and fed into a parameter generator.
   * This generator dynamically adjusts the weight parameters of the LoRA adapters embedded inside the SAM3 Vision Transformer (ViT).
   * This forces the image backbone to pay immediate attention to visual features related to the words in the query (early fusion).
3. **Multi-Scale Optimal Transport (OT)**:
   * The image passes through the modified ViT, extracting features at three distinct levels (Feature Pyramid Network - FPN).
   * The multi-scale OT alignment module runs the Sinkhorn matching algorithm. It aligns FPN image features with text tokens to compute a transport plan $P$ (a probability heatmap matching pixel grids to query nouns).

---

### Step 6: Sparse Prompt Extraction (GPG & SAP)
1. **GPG Scanning**: The Grounding-Aware Prompt Generator (GPG) scans the final OT transport plan to pinpoint the regions on the image showing the highest correlation with the query keywords.
2. **Scale-Aware Prompting (SAP)**:
   * The system measures the footprint size of the target region relative to the overall image dimensions.
   * **Small Target (Scale < 1%)**: SAP generates a single coordinate prompt placed exactly on the center of the target heatmap region, ignoring peripheral noise.
   * **Large Target (Scale > 1%)**: SAP extracts up to 5 point prompts distributed across the target area to ensure complete object coverage.
3. **SAM3 Input Formatting**: The coordinates are mapped back to pixel coordinates relative to the original image scale.

---

### Step 7: Boundary-Precise Mask Segmentation (SAM3 Decoder)
1. **Token Feeding**: The generated points (sparse prompts) and the aligned visual features are fed into the SAM3 transformer decoder.
2. **Hypotheses Generation**: The DETR-style decoder outputs 3 distinct candidate segmentation masks alongside predicted confidence/IoU scores.
3. **Best Candidate Selection**: The candidate mask with the highest predicted IoU score is selected as the final segmentation result.

---

### Step 8: Post-Processing & Output Compile (Disk Sync)
1. **Binary Thresholding**: The output logits are processed through a sigmoid function. Values greater than $0.5$ are mapped to a binary segmentation mask.
2. **Overlay Composing**: A visual overlay image is compiled: the original image is blended with the segmentation mask colored in semi-transparent cyan/red at $40\%$ opacity.
3. **Local File System Saving**:
   * The original uploaded image is saved as: `backend/uploads/<project_id>_<hash>_original.png`
   * The binary mask is saved as: `backend/uploads/<project_id>_<hash>_mask.png`
   * The overlay composite is saved as: `backend/uploads/<project_id>_<hash>_overlay.png`

---

### Step 9: Database Committal & Project Resolution (Firestore Sync)
1. **Firestore Updates**: The Flask server updates the corresponding document in the `projects` collection in Firestore:
   * Sets the `originalUrl`, `maskUrl`, and `overlayUrl` to point to the saved file paths (e.g. `/uploads/...`).
   * Sets the project's status to `completed`.
2. **Deduction Committal**: The backend calls `commit_reservation()`, changing the reservation status to `committed` and documenting the completed transaction in the database audit logs.

---

### Step 10: Instant UI Render Update (React Client)
1. **Real-time Synchronization**: Because the React client is subscribed to the project's Firestore document using real-time listeners (`onSnapshot`), it instantly detects when the project status transitions from `pending` to `completed` and reads the newly populated URLs.
2. **User Display**: The interface replaces the loading spinner with the interactive result viewport, allowing the user to view the original image, toggle the mask overlay, download output files, and review processing metrics.
