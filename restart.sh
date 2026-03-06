#!/bin/bash
set -e

echo "🔴 Killing existing processes..."

# Kill anything on port 3000 (backend)
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Kill anything on port 5173 (Vite)
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Kill any stray node/vite processes by name
pkill -f "node index.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

sleep 1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🟢 Starting backend (port 3000)..."
nohup node "$SCRIPT_DIR/index.js" > "$SCRIPT_DIR/server.log" 2>&1 &
echo "   Backend PID: $!"

echo "🟢 Starting frontend (port 5173)..."
nohup npm --prefix "$SCRIPT_DIR/chat-ui" run dev > "$SCRIPT_DIR/chat-ui/vite.log" 2>&1 &
echo "   Frontend PID: $!"

sleep 2

echo ""
echo "✅ Both servers are running!"
echo "   → Backend:  http://localhost:3000/health"
echo "   → Frontend: http://localhost:5173"
echo ""
echo "📄 Logs:"
echo "   tail -f $SCRIPT_DIR/server.log"
echo "   tail -f $SCRIPT_DIR/chat-ui/vite.log"
