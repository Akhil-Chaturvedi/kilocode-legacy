# Kilo Code Agent Support - Implementation Plan

## Goal

Enable Kilo Code's main agent to spawn sub-agents (like Kimi Code's `explore`, `coder`, `plan` agents) to delegate tasks and collect results. The main agent acts as an orchestrator, spawning agents in parallel or sequence, and using their outputs to accomplish complex goals.

## How Kimi Code Does It (From Real Session Export)

The session export at `E:\Akhil\Stuff\kimi-code-vs-code\kimi-export-session_-20260728-092901.md` shows the exact pattern:

1. Main agent receives a complex task (build a website)
2. It spawns an `explore` sub-agent with `Agent` tool call:
   ```json
   {
     "subagent_type": "explore",
     "description": "Study gemma dashboard evolution chart",
     "prompt": "Explore E:/Akhil/Stuff/SILA/misc/gemma-challenge/..."
   }
   ```
3. While the sub-agent runs, the main agent continues reading files in parallel
4. The sub-agent returns a comprehensive `[summary]` section
5. The main agent uses that summary to continue its work

The sub-agent output format:
```
agent_id: agent-0
actual_subagent_type: explore
status: completed

[summary]
... detailed findings ...
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Main Agent (Orchestrator)                                 │
│  - Receives user's complex task                             │
│  - Breaks it down into sub-tasks                            │
│  - Spawns sub-agents via Agent tool                         │
│  - Collects results and synthesizes final output             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Agent Tool Call
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Agent Tool (src/core/tools/agent/)                         │
│  - Receives: subagent_type, description, prompt, model      │
│  - Creates agent instance                                   │
│  - Runs agent (foreground or background)                    │
│  - Returns structured output with [summary]                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Agent Runner                                              │
│  - Builds agent from type definition                        │
│  - Restores/persists context                                │
│  - Runs the agent loop                                      │
│  - Applies summary continuation if response too short       │
│  - Returns final output                                     │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Agent Type System

Define agent types that can be spawned. Each type has:
- **System prompt** - The agent's personality and capabilities
- **Tool policy** - Which tools the agent can use (inherit all, or allowlist)
- **Default model** - Optional model override

**Files to create:**
- `src/core/agent-types.ts` - Agent type definitions and registry
- `src/core/agent-types.test.ts` - Tests

**Agent types to support initially:**
- `explore` - Research/exploration agent (read-only tools)
- `coder` - Coding agent (all tools)
- `plan` - Planning agent (read-only, focused on analysis)

### Phase 2: Agent Instance Management

Track spawned agent instances with their state, context, and output.

**Files to create:**
- `src/core/agent-instance.ts` - Agent instance record and store
- `src/core/agent-instance.test.ts` - Tests

**Key data per instance:**
- `agent_id` - Unique identifier
- `subagent_type` - Which type of agent
- `status` - idle | running_foreground | running_background | completed | failed | killed
- `description` - Short task description
- `launch_spec` - Model override, effective model
- `context_path` - Path to context.jsonl
- `output_path` - Path to output file

### Phase 3: Agent Spawning Tool

Create the `Agent` tool that the main agent calls to spawn sub-agents.

**Files to create:**
- `src/core/tools/agent/` - Agent tool implementation
- `src/core/tools/agent/description.md` - Tool description for LLM
- `src/core/tools/agent/__init__.ts` - Main tool class

**Tool parameters:**
```typescript
interface AgentToolParams {
  description: string;       // Short (3-5 word) description
  prompt: string;            // The task for the agent
  subagent_type: string;     // "explore" | "coder" | "plan"
  model?: string;            // Optional model override
  resume?: string;           // Optional agent ID to resume
  run_in_background?: boolean; // Default false
  timeout?: number;          // Timeout in seconds
}
```

**Output format:**
```
agent_id: a1b2c3d4
actual_subagent_type: explore
status: completed

[summary]
... detailed findings from the agent ...
```

### Phase 4: Agent Runner

Implement the actual agent execution logic.

**Files to create:**
- `src/core/agent-runner.ts` - Foreground and background agent runners
- `src/core/agent-runner.test.ts` - Tests

**Key patterns from Kimi Code:**
1. **Summary continuation** - If agent response < 200 chars, prompt it to continue with more detail
2. **Context persistence** - Save/restore conversation context per agent instance
3. **Wire protocol** - Forward subagent events to the parent agent's UI
4. **Role system** - Prevent sub-agents from spawning sub-agents

### Phase 5: Integration with Kilo Code's Existing Architecture

Wire the agent system into Kilo Code's existing tool and message system.

**Files to modify:**
- `src/core/tools/index.ts` - Register the Agent tool
- `src/core/toolset.ts` - Add Agent tool to available tools
- `src/core/messages/extension.ts` - Add SubagentEvent message type

**Key integration points:**
1. The Agent tool must be available to the main agent (role: "root")
2. Sub-agent events should be forwarded to the UI for display
3. Approval requests from sub-agents should be forwarded to the user
4. Background agent completion should trigger a notification

## Detailed Implementation Steps

### Step 1: Create Agent Type Definitions

```typescript
// src/core/agent-types.ts
export interface AgentTypeDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  toolPolicy: ToolPolicy;
  defaultModel?: string;
  supportsBackground: boolean;
}

export type ToolPolicyMode = "inherit" | "allowlist";

export interface ToolPolicy {
  mode: ToolPolicyMode;
  tools?: string[];
}
```

### Step 2: Create Agent Instance Store

```typescript
// src/core/agent-instance.ts
export interface AgentInstanceRecord {
  agentId: string;
  subagentType: string;
  status: AgentStatus;
  description: string;
  createdAt: number;
  updatedAt: number;
  lastTaskId?: string;
  launchSpec: AgentLaunchSpec;
}

export type AgentStatus = 
  | "idle" 
  | "running_foreground" 
  | "running_background" 
  | "completed" 
  | "failed" 
  | "killed";
```

### Step 3: Implement Agent Tool

The Agent tool should:
1. Validate parameters (model exists, subagent type exists)
2. Check role (only root can spawn agents)
3. Create or resume agent instance
4. Run agent (foreground or background)
5. Return structured output

### Step 4: Implement Agent Runner

The runner should:
1. Build agent from type definition (system prompt, tools)
2. Restore context from disk if resuming
3. Run the agent loop
4. Apply summary continuation if response < 200 chars
5. Save context and output

### Step 5: Add Background Task Support

For `run_in_background: true`:
1. Create task in background task manager
2. Run agent as async task
3. Support timeout, cancellation
4. Notify parent when complete

## Key Patterns to Copy from Kimi Code

### 1. Summary Continuation
```typescript
const SUMMARY_MIN_LENGTH = 200;
const SUMMARY_CONTINUATION_PROMPT = `
Your previous response was too brief. Please provide a more comprehensive summary that includes:
1. Specific technical details and implementations
2. Detailed findings and analysis
3. All important information that the parent agent should know
`;

// After agent completes, if response < 200 chars, prompt to continue
if (finalResponse.length < SUMMARY_MIN_LENGTH) {
  // Run agent again with continuation prompt
}
```

### 2. Context Persistence
Each agent instance gets its own directory:
```
.kilocode/agents/{agentId}/
  ├── meta.json       # Agent instance record
  ├── context.jsonl   # Conversation context
  └── output          # Final output text
```

### 3. Role System
```typescript
if (runtime.role !== "root") {
  return ToolError("Subagents cannot launch other subagents.");
}
```

### 4. Subagent Event Forwarding
Forward subagent activity to the parent agent's UI stream so the user can see what the sub-agent is doing.

## Files to Create (Summary)

| File | Purpose |
|------|---------|
| `src/core/agent-types.ts` | Agent type definitions and registry |
| `src/core/agent-instance.ts` | Agent instance records and store |
| `src/core/agent-runner.ts` | Foreground/background agent execution |
| `src/core/tools/agent/__init__.ts` | Agent tool implementation |
| `src/core/tools/agent/description.md` | Tool description for LLM |
| `src/core/agent-types.test.ts` | Tests for agent types |
| `src/core/agent-instance.test.ts` | Tests for instance management |
| `src/core/agent-runner.test.ts` | Tests for agent runner |

## Files to Modify

| File | Change |
|------|--------|
| `src/core/tools/index.ts` | Register Agent tool |
| `src/core/toolset.ts` | Add Agent tool to toolset |
| `src/core/messages/extension.ts` | Add SubagentEvent type |
| `src/core/tools/agent/description.md` | Tool description for LLM |
