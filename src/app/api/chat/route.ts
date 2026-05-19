import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // 1. Try Pollinations AI (Unlimited & Lifetime Free OpenAI-compatible Endpoint)
    try {
      const res = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openai-fast',
          messages: messages,
        })
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          return NextResponse.json({ content });
        }
      } else {
        console.warn('Pollinations AI failed, status:', res.status);
      }
    } catch (pollErr) {
      console.error('Pollinations AI error, attempting API fallbacks...', pollErr);
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // 2. Try OpenRouter Fallback
    if (openRouterKey) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterKey}`,
            'HTTP-Referer': 'https://fboosting.vercel.app',
            'X-Title': 'BoostSocial Chat'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: messages,
          })
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            return NextResponse.json({ content });
          }
        } else {
          console.warn('OpenRouter failed, status:', res.status);
        }
      } catch (orErr) {
        console.error('OpenRouter request error, attempting Gemini fallback...', orErr);
      }
    }

    // 3. Fallback directly to Gemini API
    if (geminiKey) {
      try {
        // Map messages format to Gemini contents format
        // Gemini API uses 'user' and 'model' for roles. 'system' is passed as systemInstruction.
        const systemMsg = messages.find((m: any) => m.role === 'system');
        const chatMsgs = messages.filter((m: any) => m.role !== 'system');

        const contents = chatMsgs.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const body: any = { contents };
        if (systemMsg) {
          body.systemInstruction = {
            parts: [{ text: systemMsg.content }]
          };
        }

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            return NextResponse.json({ content });
          }
        } else {
          console.error('Gemini API failed, status:', res.status);
        }
      } catch (geminiErr) {
        console.error('Gemini request error:', geminiErr);
      }
    }

    return NextResponse.json({ error: 'All AI models failed' }, { status: 502 });

  } catch (err: any) {
    console.error('Chat endpoint error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
