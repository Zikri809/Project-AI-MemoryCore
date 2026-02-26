import { google } from "@ai-sdk/google"
import { stepCountIs, streamText } from "ai"
import { systemPrompt } from "@/lib/systemPrompt"
import { buildVfsTools } from "./_tools/tools"
import { createClient } from "@/utils/supabase/server"

// Allow streaming responses up to 30 seconds
export const maxDuration = 60

export async function POST(req: Request) {
    const { messages } = await req.json()

    // Ensure user is authenticated before allowing AI access (saving costs & enforcing RLS guarantees)
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return new Response("Unauthorized", { status: 401 })
    }

    const result = streamText({
        model: google("gemini-3.0-flash-preview"),
        system: systemPrompt,
        messages,
        tools: buildVfsTools(),
        stopWhen: stepCountIs(5), // Allow Gemini to execute tools and self-correct up to 5 times per user message
    })

    return result.toTextStreamResponse()
}
