import Parser from 'rss-parser';
const parser = new Parser();

export default async function fetchFeedSummaries(url) {
  const feed = await parser.parseURL(url);
  return feed.items.map(item => item.contentSnippet || item.summary || item.description || '');
}