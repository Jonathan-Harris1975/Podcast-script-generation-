import Parser from 'rss-parser';
const parser = new Parser();

export async function fetchFeedSummaries(feedUrl, maxItems = 10) {
  const feed = await parser.parseURL(feedUrl);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const filteredItems = feed.items
    .filter(item => {
      const pubDate = new Date(item.pubDate || item.isoDate);
      return pubDate >= sevenDaysAgo;
    })
    .slice(0, maxItems)
    .map(item => ({
      title: item.title,
      summary: item.contentSnippet || item.summary || '',
    }));

  return filteredItems;
}
