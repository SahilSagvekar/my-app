import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}+shorts`;

    const html = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    }).then(r => r.text());

    // Extract the ytInitialData object
    const initialDataString = html.match(/ytInitialData"\] = (.*?);\n/);
    if (!initialDataString) {
      return NextResponse.json({ error: "Failed to extract results" }, { status: 500 });
    }

    const data = JSON.parse(initialDataString[1]);

    // Parse video items
    const videos = [];

    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

    for (const item of contents) {
      const video = item.videoRenderer;
      if (!video) continue;

      const title = video.title?.runs?.[0]?.text || "";
      const views = video.viewCountText?.simpleText || "";
      const published = video.publishedTimeText?.simpleText || "";
      const id = video.videoId;

      if (!id) continue;

      videos.push({ title, views, published });
    }

    // ---- SEND TO AI FOR PATTERN ANALYSIS ----

    const prompt = `
You are a YouTube title optimization expert.

Based on the following viral video titles, extract:
1. Trending title patterns
2. Hooks used
3. Common keywords
4. Create 10 NEW high-performing titles for: "${query}"

Viral titles:
${videos.map(v => "- " + v.title).join("\n")}
`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const json = await aiRes.json();

    return NextResponse.json({
      suggestions: json.choices?.[0]?.message?.content || "",
      scraped: videos,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
