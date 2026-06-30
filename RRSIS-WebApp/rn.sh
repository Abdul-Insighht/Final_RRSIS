#!/bin/bash

# ============================================================
#  GeoSegAI - Run Script (WSL)
#  Starts the Flask backend and Vite frontend concurrently.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR"

# Ensure ~/.local/bin is on PATH (for --user pip installs)
export PATH="$HOME/.local/bin:$PATH"

echo "=================================================="
echo "  GeoSegAI - Starting Servers"
echo "=================================================="
echo "  Project root : $SCRIPT_DIR"
echo "  Backend      : http://localhost:5000"
echo "  Frontend     : http://localhost:5173"
echo "=================================================="

# ---------- Kill stale processes ----------
echo ""
echo "[0/2] Killing stale processes..."
# Kill WSL-side processes
pkill -f "python3 app.py" 2>/dev/null && echo "  Killed old Flask process."
pkill -f "vite"           2>/dev/null && echo "  Killed old Vite process."
# Kill Windows-side Node/Vite processes (they hold ports 517x from previous runs)
powershell.exe -Command "Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force" 2>/dev/null && echo "  Killed Windows node processes."
sleep 1

# ---------- Ensure pip is available ----------
ensure_pip() {
    if python3 -m pip --version &>/dev/null 2>&1; then
        return 0
    fi
    echo "  pip not found. Bootstrapping pip via get-pip.py..."
    TMP_GET_PIP=$(mktemp /tmp/get-pip-XXXX.py)
    curl -sSL https://bootstrap.pypa.io/get-pip.py -o "$TMP_GET_PIP" 2>&1
    python3 "$TMP_GET_PIP" --user -q --break-system-packages 2>&1
    rm -f "$TMP_GET_PIP"
    export PATH="$HOME/.local/bin:$PATH"
    if python3 -m pip --version &>/dev/null 2>&1; then
        echo "  pip installed successfully."
    else
        echo "  ERROR: Could not install pip. Run in WSL: sudo apt install python3-pip"
        exit 1
    fi
}

# ---------- Backend ----------
echo ""
echo "[1/2] Starting Flask backend..."
cd "$BACKEND_DIR" || { echo "ERROR: backend dir not found"; exit 1; }

# Check if flask is importable
if ! timeout 5 python3 -c "import flask" &>/dev/null 2>&1; then
    echo "  Flask not found. Installing core dependencies..."
    ensure_pip

    # Install core packages (skip heavy torch/transformers)
    CORE_PKGS="flask==3.0.0 flask-cors==4.0.0 PyJWT==2.8.0 python-dotenv==1.0.0 Werkzeug==3.0.1 Pillow firebase-admin numpy einops"
    python3 -m pip install --user -q --break-system-packages $CORE_PKGS
    echo "  Core packages installed."
fi

if ! timeout 5 python3 -c "import flask" &>/dev/null 2>&1; then
    echo ""
    echo "  ERROR: Flask still not importable."
    echo "  Please run in WSL:  sudo apt install python3-pip && pip3 install flask"
    exit 1
fi

echo "  Flask is available. Starting app..."
python3 app.py &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# ---------- Frontend ----------
echo ""
echo "[2/2] Starting Vite frontend..."
cd "$FRONTEND_DIR" || { echo "ERROR: frontend dir not found"; exit 1; }
npm run dev -- --port 5173 &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "=================================================="
echo "  Both servers are running."
echo "  Press Ctrl+C to stop everything."
echo "=================================================="

trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait $BACKEND_PID $FRONTEND_PID
