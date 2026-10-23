#!/bin/bash
set -e
HQ="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$HQ/bin/"* "$HQ/server.py"
mkdir -p "$HQ/state/agents" "$HQ/state/cards" "$HQ/state/queue" "$HOME/.local/bin"
ln -sf "$HQ/bin/hq" "$HOME/.local/bin/hq"

if ! echo "$PATH" | tr ':' '\n' | grep -qx "$HOME/.local/bin"; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
  echo "Added ~/.local/bin to PATH in ~/.zshrc (open a new terminal)."
fi

for dir in "$HQ"/agents/*/; do
  id="$(basename "$dir")"
  mkdir -p "$dir/.claude" "$dir/work"
  cat > "$dir/.claude/settings.json" <<JSON
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "$HOME/.local/bin/hq hook start" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "$HOME/.local/bin/hq hook start" }] }],
    "Notification": [{ "hooks": [{ "type": "command", "command": "$HOME/.local/bin/hq hook notify" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "$HOME/.local/bin/hq hook stop" }] }]
  },
  "permissions": {
    "allow": ["Bash(hq:*)", "Read", "Write(./work/**)", "Edit(./work/**)", "WebSearch", "WebFetch"]
  }
}
JSON
  echo "  wired up: $id"
done
echo "Done. Start the dashboard with:  python3 $HQ/server.py"
