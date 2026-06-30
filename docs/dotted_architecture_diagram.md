# Dotted-Line System Architecture Blueprint

This document details the modular boundaries and communication channels of the GeoSegAI platform and the Enhanced RRSIS-OT model using a dotted-line structural blueprint.

---

## 🗺️ Dotted-Line Structural Blueprint

```
+.........................................................................+
.                          React SPA Client (Vite)                        .
.  +--------------------+   +-------------------+   +------------------+  .
.  |    Dashboard UI    |   | Segmentation Play |   |   Billing/SaaS   |  .
.  +---------┬----------+   +---------┬---------+   +--------┬---------+  .
+............│........................│......................│............+
             │                        │                      │
      HTTPS  │ REST                   │                      │ Real-time
      POST   │ Upload                 │                      │ Firestore Sync
             ▼                        ▼                      ▼
+.........................................................................+
.                     Google Firebase / Firestore Cloud                   .
.  +--------------------+   +-------------------+   +------------------+  .
.  |     Auth Users     |   | Projects/Metadata |   |   Reservations   |  .
.  +--------------------+   +-------------------+   +------------------+  .
+.....................................▲......................▲............+
                                      :                      :
                                      : Firestore            : Firestore
                                      : Reads/Writes         : Transactions
                                      ▼                      ▼
+.........................................................................+
.                        Flask API Gateway Backend                        .
.  +--------------------+   +-------------------+   +------------------+  .
.  |   Auth Middleware  |   |  Credit Validator |   |  Model Registry  |  .
.  +--------------------+   +---------┬---------+   +--------┬---------+  .
+.....................................│......................│............+
                                      │                      │
                                      │ Internal Function    │ Lazy-loads &
                                      │ Call (VRAM/RAM)      │ routes payload
                                      ▼                      ▼
+.........................................................................+
.                       PyTorch Core Inference Engine                     .
.  +-------------------------------------------------------------------+  .
.  |                     Enhanced_RRSIS_UOT Wrapper                    |  .
.  |                                                                   |  .
.  |  +--------------------+                 +----------------------+  |  .
.  |  |    Swin-BERT /     |                 |  Text-Guided LoRA    |  |  .
.  |  |   Text Encoder     |                 |   Attention Mod      |  |  .
.  |  +────────┬───────────+                 +──────────┬───────────+  |  .
.  |           │                                        │              |  .
.  |           └───────────────┐        ┌───────────────┘              |  .
.  |                           ▼        ▼                              |  .
.  |                  +───────────────────────────+                    |  .
.  |                  |   Multi-Scale Optimal     |                    |  .
.  |                  |     Transport Aligner     |                    |  .
.  |                  +─────────────┬─────────────+                    |  .
.  |                                │                                  |  .
.  |                                ▼                                  |  .
.  |                  +───────────────────────────+                    |  .
.  |                  |    Grounding-Aware (GPG)  |                    |  .
.  |                  |  & Scale-Aware (SAP) Gen  |                    |  .
.  |                  +─────────────┬─────────────+                    |  .
.  |                                │                                  |  .
.  |                                ▼ Point Prompts                    |  .
.  |                  +───────────────────────────+                    |  .
.  |                  |   SAM3 Segment Decoder    |                    |  .
.  |                  +─────────────┬─────────────+                    |  .
.  |                                │                                  |  .
.  |                                ▼ Mask Logits                      |  .
.  |                  +───────────────────────────+                    |  .
.  |                  |    Compositor/Post-proc   |                    |  .
.  |                  +───────────────────────────+                    |  .
.  +-------------------------------------------------------------------+  .
+.........................................................................+
```

---

## 🔗 Description of Dotted Boundaries and Communication Channels

1. **Client Boundary (`React SPA Client`)**:
   * Isolated entirely as a static browser application running inside the client sandbox.
   * Communcates with the database layer using real-time WebSockets (Firestore SDK hooks) and dispatching payload bytes using secure HTTP calls.
2. **Data & State Boundary (`Google Firebase / Firestore Cloud`)**:
   * Serves as the central persistent state management gate.
   * Interacts directly with the Frontend Client for instantaneous UI renderings (dotted visual notifications) and acts as the gatekeeper for user identities.
   * Interacts with the Backend controller using database-locked multi-write transactions.
3. **Controller Boundary (`Flask API Gateway Backend`)**:
   * Manages routes validation and token decoding checks.
   * Performs the credit lock reservation on the Firestore database and routes verified inputs downstream to the PyTorch memory pipeline.
4. **Heavy Compute Boundary (`PyTorch Core Inference Engine`)**:
   * Encapsulates all deep learning components.
   * Coordinates input encoding (Swin-BERT/ViT backbones), textual attention modifications (Dynamic LoRA), visual matching alignment calculations (Optimal Transport Sinkhorn loops), and point-prompt coordinate extractions (GPG/SAP prompt generation) to run SAM3 boundary segmentation decoding steps.
