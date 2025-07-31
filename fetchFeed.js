import Parser from "rss-parser";
const parser = new Parser();

export async function fetchFeed(url, maxItems = 10) {
  const feed = await parser.parseURL(url);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const filteredItems = feed.items
    .filter(item => {
      const pubDate = new Date(item.pubDate);
      return pubDate >= sevenDaysAgo;
    })
    .slice(0, maxItems);

  return filteredItems.map(item => ({
    title: item.title,
    summary: item.contentSnippet || item.content || item.description || "",
    pubDate: item.pubDate
  }));
}