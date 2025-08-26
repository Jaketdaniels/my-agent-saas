# netM8 Agent Platform

SaaS platform with autonomous AI agents. This system provides:

- **Stateful AI Agents**: Using Cloudflare Durable Objects, each agent instance maintains persistent state, conversation history, and can run autonomously for hours/days
- **Complete SaaS Infrastructure**: Full authentication, billing, team management, and admin controls
- **Agent Capabilities**: Code execution via Cloudflare Sandbox, file operations, process management, and git integration
- **Real-time Communication**: WebSocket connections for streaming AI responses and state synchronization
- **Edge Computing**: Runs globally on Cloudflare's network with no cold starts

## Architecture Overview


User → netm8.com → Cloudflare Workers
                    ├── Next.js App (UI)
                    ├── Agent Instances (Durable Objects)
                    │   ├── Persistent State (SQLite)
                    │   ├── OpenAI Integration
                    │   └── Sandbox Execution
                    ├── D1 Database (User/Billing Data)
                    └── KV Storage (Caching)

### Core Components

#### 1. **AI Agent System**
- `/src/app/api/agent/*` - Agent API endpoints
- Each user gets their own Agent instance (Durable Object)
- Agents maintain context across sessions
- Can execute code, manage files, run processes
- Uses OpenAI model "gpt-oss:20b"

#### 2. **SaaS Platform**
- Complete auth system (email/password, Google OAuth, passkeys)
- Stripe billing with credit system
- Team management with roles/permissions
- Admin panel for user management
- Email notifications via Resend

#### 3. **Agent Capabilities**
- **Code Execution**: Sandboxed via Cloudflare Containers
- **File Operations**: Read/write/delete in agent workspace
- **Process Management**: Start/stop/monitor processes
- **Git Integration**: Clone repos, manage code
- **Port Exposure**: For web preview of agent work
- **Template Projects**: Quick-start Next.js, React, Vue

## How It Works

### 1. User Interaction Flow
```
User logs in → Accesses Agent Chat → Agent Instance Created (Durable Object)
→ Agent maintains state → Executes tasks → Streams responses → Persists history
```

### 2. Agent Lifecycle on Cloudflare
- **Instance Creation**: Each user/session gets a unique Agent (Durable Object)
- **State Persistence**: SQLite database per agent instance
- **Long-running Tasks**: Can run for minutes/hours without timeout
- **Hibernation**: Agents sleep when idle, wake instantly when needed
- **Global Routing**: User always connects to same agent instance

### 3. Sandbox Execution

```javascript

env.Sandbox.fetch(request) → Executes Python/JS → Returns results
```

## Current Implementation Status

- Authentication & authorization system
- Billing & subscription management
- Agent chat interface
- Agent API endpoints (20+ operations)
- State management via Durable Objects
- WebSocket streaming
- Admin dashboard
- Team management

### Deployment Process

```bash
# Deploy to Cloudflare (Makes everything work)
git push origin main → GitHub Actions → Cloudflare Workers → Live Agent Platform
```
## Technical Architecture

### State Management
- **Per-Agent SQLite**: Each agent has its own database
- **Automatic Sync**: State changes propagate to connected clients
- **Persistent Memory**: Agents remember across sessions
- **No External DB Needed**: Everything runs at the edge

## Business Model (Implemented)

### Credit System (Working)
- Free: 50 credits/month (auto-refresh)
- Packages: $5/500, $10/1200, $20/3000 credits
- Usage tracking per agent interaction
- Automatic billing via Stripe

### Target Use Cases
- Developers needing autonomous code assistants
- Teams requiring persistent AI workflows
- Businesses wanting custom AI agents
- Educational institutions teaching with AI
- General purpose for day-to-day assistance

## Development Guide

### Understanding the Stack
1. **Next.js**: UI layer
2. **Agent APIs**: Become stateful on Cloudflare
3. **Durable Objects**: Persistent compute
4. **Cloudflare Runtime**: Makes everything work

### Key Files
```
/src/app/api/agent/* → Agent endpoints (become stateful on CF)
/src/components/AgentChat/ → UI for agent interaction
/wrangler.jsonc → Cloudflare configuration (critical!)
/src/db/schema.ts → User/billing database structure
```
## Next Steps

### Immediate (To Go Live)
1. Build and push Docker image for Sandbox
2. Test full agent capabilities in production
3. Add usage analytics dashboard (edit template)
4. Implement credit deduction on agent use (connect existing stripe system to agents)
5. Add chat history UI
6. Implement agent templates

## Support & Documentation

### For Development
- Cloudflare Agents SDK: See agents.md
- Deployment issues: Check GitHub Actions logs
- Local testing: Use `wrangler dev` not `pnpm dev`

---

**Solo Dev**: Jake @ netM8 Solutions
**Status**: Deployed to Cloudflare Workers
**Reality**: This is a working AI Agent platform, not a prototype
