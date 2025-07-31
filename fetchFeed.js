import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 10000, // 10 second timeout
  maxRedirects: 5, // maximum number of redirects to follow
  headers: {
    'User-Agent': 'RSS-Podcast-Processor/1.0 (+https://github.com/your-repo)'
  }
});

export async function fetchFeedSummaries(feedUrl, maxItems = 20, maxAgeDays = 7) {
  try {
    if (!feedUrl) {
      throw new Error('Feed URL is required');
    }

    // Validate URL format
    try {
      new URL(feedUrl);
    } catch (err) {
      throw new Error('Invalid URL format');
    }

    const feed = await parser.parseURL(feedUrl);
    const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

    if (!feed.items || !Array.isArray(feed.items)) {
      throw new Error('No items found in feed or invalid feed structure');
    }

    const filteredItems = feed.items
      .filter(item => {
        try {
          const pubDate = new Date(item.pubDate || item.isoDate || item.date);
          return pubDate >= cutoffDate;
        } catch (err) {
          console.warn('Failed to parse date for item:', item.title);
          return false; // Exclude items with invalid dates
        }
      })
      .slice(0, maxItems)
      .map(item => ({
        title: item.title || 'Untitled',
        summary: item.contentSnippet || item.summary || item.description || '',
        date: item.pubDate || item.isoDate || item.date || 'Unknown date'
      }));

    if (filteredItems.length === 0) {
      console.warn('No recent items found within the specified timeframe');
    }

    return filteredItems;

  } catch (err) {
    console.error('Error fetching feed:', err);
    throw new Error(`Failed to fetch feed: ${err.message}`);
  }
      }
