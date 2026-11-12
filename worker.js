
const ALLOWED_ORIGIN = "https://luxhustle01-ux.github.io";

const SYSTEM_INSTRUCTION = `
You are JARVIS, a personal AI assistant.

Personality:
- Intelligent, calm, confident and natural.
- Speak clearly and conversationally.
- Be proactive and genuinely helpful.
- Give detailed answers when needed.
- Never pretend to have performed an action you cannot perform.
- Be honest about limitations.

Your purpose is to assist your owner with everyday life,
research, planning, learning, problem solving and productivity.

You are a capable personal AI assistant, not a scripted chatbot.
`;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });

    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ error: "Origin not allowed" }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        name: "JARVIS",
        status: "online",
        version: "1.0"
      });
    }

    if (request.method !== "POST" || url.pathname !== "/chat") {
      return json({ error: "Endpoint not found" }, 404);
    }

    if (!env.GEMINI_API_KEY) {
      return json({ error: "AI API key is not configured" }, 500);
    }

    try {
      const body = await request.json();

      const message = body.message?.trim();

      if (!message || message.length > 12000) {
        return json({
          error: "Please provide a message under 12,000 characters."
        }, 400);
      }

      const payload = {
        model: "gemini-3.8-flash",
        input: message,
        system_instruction: SYSTEM_INSTRUCTION,
        generation_config: {
          max_output_tokens: 4096
        }
      };

      if (body.previousInteractionId) {
        payload.previous_interaction_id =
          body.previousInteractionId;
      }

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error("Gemini API error:", result);

        return json({
          error: "The AI service could not complete your request."
        }, 502);
      }

      const reply = result.output_text ||
        result.steps
          ?.filter(step => step.type === "model_output")
          .flatMap(step => step.content || [])
          .filter(item => item.type === "text")
          .map(item => item.text)
          .join("\n");

      if (!reply) {
        return json({
          error: "JARVIS received an empty AI response."
        }, 502);
      }

      return json({
        reply,
        interactionId: result.id || null,
        status: "success"
      });

    } catch (error) {
      console.error("JARVIS error:", error);

      return json({
        error: "Something went wrong. Please try again."
      }, 500);
    }
  }
};
