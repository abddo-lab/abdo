# N8N Workflow Integration

This module provides a custom N8N workflow integration for Caret Agent. Each user gets their own N8N instance with AI assistance connected to our API.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Caret Agent App                          │
├─────────────────────────────────────────────────────────────┤
│  WorkflowsPanel.tsx  │  n8n-manager.ts  │  n8n-deploy.sh   │
│         │                    │                    │         │
│         └────────────────────┼────────────────────┘         │
│                              │                              │
└──────────────────────────────┼──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    N8N Instance                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Editor UI   │  │   Backend   │  │  AI Engine  │        │
│  │  (Vue.js)    │  │  (Node.js)  │  │ (Our API)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  Custom Branding: "Caret Workflows"                        │
│  Theme: Monochrome (black/white)                           │
│  AI: Connected to http://crate.ftp.sh/v1                   │
└─────────────────────────────────────────────────────────────┘
```

## Features

1. **One Instance Per User**: Each user gets exactly one N8N instance
2. **Custom Branding**: N8N is rebranded as "Caret Workflows"
3. **Monochrome Theme**: UI matches our black/white aesthetic
4. **AI Assistant**: Connected to our API with credit-based usage
5. **Public URLs**: Each workflow gets a URL like `/workflow/{slug}`

## Files

### Frontend
- `WorkflowsPanel.tsx` - Main workflow management UI
- `n8n-manager.ts` - Instance and workflow management logic

### Backend/Scripts
- `customize-n8n.sh` - Customizes N8N branding and theme
- `n8n-deploy.sh` - Deploys and manages N8N instances

### Database
- `n8n_instances` - Stores instance metadata
- `workflows` - Stores workflow metadata

## Usage

### Creating an Instance
1. Go to Workflows panel
2. Click "Create Your Instance"
3. Enter a workflow name
4. The name becomes the public URL slug

### Creating a Workflow
1. Click "New Workflow" in the sidebar
2. Enter workflow name and description
3. The slug is automatically generated

### Accessing N8N
1. Click "Open N8N Editor" on your instance
2. Full N8N editor opens in a new tab
3. Build workflows using the visual editor

### AI Assistant
1. Open the AI Assistant panel
2. Ask questions about building workflows
3. Usage is tracked and deducted from daily credits

## API Integration

The N8N AI assistant connects to our API at `http://crate.ftp.sh/v1`:

```typescript
const response = await chatCompletion("claude-fable-5", messages, 0.4);
```

Credit usage is tracked via:
```typescript
await usageDB.addUsage("claude-fable-5", promptTokens, completionTokens, cost, userId);
```

## Deployment

### Development
```bash
# Customize N8N
./scripts/customize-n8n.sh

# Start an instance
./scripts/n8n-deploy.sh create <user_id> <workflow_name> <port>
./scripts/n8n-deploy.sh start <user_id>
```

### Production
1. Run the customization script
2. Build N8N with `pnpm build`
3. Deploy using Docker or process manager
4. Configure reverse proxy for public access

## Environment Variables

```bash
# N8N Configuration
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
```

## Database Schema

### n8n_instances
```typescript
interface N8nInstance {
  id: string;
  userId: string;
  workflowName: string;
  slug: string;
  status: "creating" | "running" | "stopped" | "error";
  port: number;
  apiUrl: string;
  apiKey: string | null;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number | null;
  error: string | null;
}
```

### workflows
```typescript
interface Workflow {
  id: string;
  instanceId: string;
  name: string;
  slug: string;
  description: string;
  n8nWorkflowId: string | null;
  status: "draft" | "active" | "paused" | "error";
  createdAt: number;
  updatedAt: number;
  lastRunAt: number | null;
  runCount: number;
  error: string | null;
}
```

## Future Enhancements

1. **Docker Deployment**: Containerize N8N instances
2. **Auto-scaling**: Dynamically allocate ports and resources
3. **Workflow Templates**: Pre-built workflow templates
4. **Execution History**: Track workflow runs and performance
5. **Cost Analytics**: Detailed usage and cost breakdown
6. **Multi-user Collaboration**: Share workflows between users
7. **Webhook Management**: Handle incoming webhooks
8. **Credential Vault**: Secure credential storage
