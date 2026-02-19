# CollabBoard
Real-time collaborative whiteboard with AI agent

See CollabBoard_PRD_v5_0_Fabric.md for full spec.

## Setup

1. Copy `.env.example` to `.env.local` and add Supabase URL + anon key.
2. Run migrations (see SUPABASE_SETUP.md).
3. AI: Supabase Edge Function `ai-interpret` → OpenAI. Observability: LangSmith (smith.langchain.com).
