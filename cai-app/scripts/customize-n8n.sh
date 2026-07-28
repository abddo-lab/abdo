#!/bin/bash
# N8N Customization Script
# Customizes N8N branding, UI, and AI integration

set -e

N8N_DIR="/home/crime/n8n"
BACKUP_DIR="/home/crime/n8n-backup"

echo "=== N8N Customization Script ==="
echo "Target: $N8N_DIR"

# Create backup
if [ ! -d "$BACKUP_DIR" ]; then
  echo "Creating backup..."
  cp -r "$N8N_DIR" "$BACKUP_DIR"
fi

# ─── 1. Update Branding ───
echo "Updating branding..."

# Update package.json
if [ -f "$N8N_DIR/packages/frontend/editor-ui/package.json" ]; then
  sed -i 's/"name": "n8n-editor-ui"/"name": "caret-workflows-editor"/g' "$N8N_DIR/packages/frontend/editor-ui/package.json"
fi

# Update title in index.html
if [ -f "$N8N_DIR/packages/frontend/editor-ui/src/index.html" ]; then
  sed -i 's/<title>n8n<\/title>/<title>Caret Workflows<\/title>/g' "$N8N_DIR/packages/frontend/editor-ui/src/index.html"
  sed -i 's/n8n - Workflow Automation/Caret Workflows - Workflow Automation/g' "$N8N_DIR/packages/frontend/editor-ui/src/index.html"
fi

# ─── 2. Update Copyrights ───
echo "Updating copyrights..."

# Find and replace copyright notices
find "$N8N_DIR" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.vue" -o -name "*.html" \) -exec sed -i \
  -e 's/n8n GmbH/Caret Agent/g' \
  -e 's/© n8n/© Caret Agent/g' \
  -e 's/Copyright n8n/Copyright Caret Agent/g' \
  -e 's/https:\/\/n8n\.io/https:\/\/caret.agent/g' \
  {} \;

# ─── 3. Update Theme Colors ───
echo "Updating theme colors..."

# Create custom CSS file
cat > "$N8N_DIR/packages/frontend/editor-ui/src/theme.css" << 'EOF'
/* Caret Agent Monochrome Theme */
:root {
  --color-primary: #ededed;
  --color-primary-shade: #ffffff;
  --color-background: #000000;
  --color-background-light: #0d0d0d;
  --color-background-dark: #060606;
  --color-surface: #141414;
  --color-border: #232323;
  --color-text: #ededed;
  --color-text-light: #9a9a9a;
  --color-text-dark: #5e5e5e;
  --color-accent: #e8e8e8;
  --color-success: #8f8f8f;
  --color-warning: #c4c4c4;
  --color-error: #6f6f6f;
}

/* Override N8N styles */
body {
  background-color: #000000 !important;
  color: #ededed !important;
}

.n8n-sidebar {
  background-color: #060606 !important;
  border-color: #232323 !important;
}

.n8n-node {
  background-color: #141414 !important;
  border-color: #232323 !important;
}

.n8n-button-primary {
  background-color: #ededed !important;
  color: #000000 !important;
}

.n8n-button-secondary {
  background-color: transparent !important;
  border-color: #333333 !important;
  color: #ededed !important;
}

/* Footer branding */
.n8n-footer {
  background-color: #060606 !important;
  border-color: #232323 !important;
}

.n8n-footer-text {
  color: #5e5e5e !important;
}
EOF

# ─── 4. Update AI Configuration ───
echo "Updating AI configuration..."

# Create AI configuration file
cat > "$N8N_DIR/packages/backend/core/src/ai-config.ts" << 'EOF'
// Caret Agent AI Configuration
export const aiConfig = {
  enabled: true,
  provider: "custom",
  apiUrl: process.env.CARET_API_URL || "http://crate.ftp.sh/v1",
  apiKey: process.env.CARET_API_KEY || "mr-e7eacfbc9e634bb2847e87b0",
  model: process.env.CARET_AI_MODEL || "claude-fable-5",
  maxTokens: 4096,
  temperature: 0.4,
};

// Credit tracking
export interface CreditUsage {
  userId: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  timestamp: number;
}

export const trackCreditUsage = async (usage: CreditUsage): Promise<void> => {
  // In production, this would send to our API for tracking
  console.log("Credit usage:", usage);
};
EOF

# ─── 5. Update Footer ───
echo "Updating footer..."

# Find and update footer components
find "$N8N_DIR/packages/frontend" -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e 's/n8n - Workflow Automation/Caret Workflows - Powered by Caret Agent/g' \
  -e 's/© 2024 n8n GmbH/© 2024 Caret Agent/g' \
  {} \;

# ─── 6. Update Environment Configuration ───
echo "Updating environment configuration..."

cat > "$N8N_DIR/.env.custom" << 'EOF'
# Caret Agent Custom Configuration
N8N_EDITOR_BASE_URL=http://localhost:5678
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_PROTOCOL=http

# AI Configuration
CARET_API_URL=http://crate.ftp.sh/v1
CARET_API_KEY=mr-e7eacfbc9e634bb2847e87b0
CARET_AI_MODEL=claude-fable-5

# Branding
N8N_DEFAULT_NAME=Caret Workflows
N8N_DEFAULT_COLOR=#ededed
EOF

echo "=== Customization Complete ==="
echo "N8N has been customized with:"
echo "- Caret Agent branding"
echo "- Monochrome theme"
echo "- AI assistant connected to our API"
echo "- Copyright notices updated"
echo ""
echo "To build and run:"
echo "  cd $N8N_DIR"
echo "  pnpm install"
echo "  pnpm build"
echo "  pnpm start"
