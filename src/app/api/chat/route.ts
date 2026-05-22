import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    // Attempt Pollinations AI (Unlimited & Lifetime Free OpenAI-compatible Endpoint)
    // equipped with automatic retry loops for maximum stability.
    let content = "";
    let attempts = 3;
    let success = false;
    let lastError: any = null;

    while (attempts > 0 && !success) {
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
          const responseText = data.choices?.[0]?.message?.content;
          if (responseText) {
            content = responseText;
            success = true;
          }
        } else {
          console.warn(`Pollinations AI attempt failed, status: ${res.status}`);
          lastError = new Error(`Pollinations returned status ${res.status}`);
        }
      } catch (err: any) {
        console.error('Pollinations AI request attempt error:', err);
        lastError = err;
      }
      
      if (!success) {
        attempts--;
        if (attempts > 0) {
          // Subtle wait before retrying (250ms)
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }
    }

    if (success && content) {
      return NextResponse.json({ content });
    }

    return NextResponse.json({ 
      error: 'Failed to fetch AI response from Pollinations',
      details: lastError?.message || lastError?.toString()
    }, { status: 502 });

  } catch (err: any) {
    console.error('Chat endpoint error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
