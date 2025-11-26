import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      query
    )}+shorts`;

    const html = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html",
        "Referer": "https://www.youtube.com/",
        "Cookie": "CONSENT=YES+cb;",
      },
    }).then((r) => r.text());

    // extract ytInitialData
    const initialDataRegex =
      /ytInitialData"\]\s*=\s*(\{.*?\});|var ytInitialData\s*=\s*(\{.*?\});/s;

    const match = html.match(initialDataRegex);

    if (!match) {
      return NextResponse.json(
        { error: "Failed to extract ytInitialData" },
        { status: 500 }
      );
    }

    const jsonString = match[1] || match[2];
    const data = JSON.parse(jsonString);

    // Extract search results
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

    const videos = [];

    for (const item of contents) {
      const v = item.videoRenderer;
      if (!v) continue;

      videos.push({
        id: v.videoId,
        title: v.title?.runs?.[0]?.text || "",
        views: v.viewCountText?.simpleText || "",
        published: v.publishedTimeText?.simpleText || "",
      });
    }

    return NextResponse.json({ videos });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
