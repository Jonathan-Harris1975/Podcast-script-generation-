        summary: item.contentSnippet || item.summary || item.description || '',
        date: item.pubDate || item.isoDate || item.date || 'Unknown date'
      }));
  } catch (err) {
    console.error('Feed Error:', err.message);
    throw new Error(`Failed to fetch feed: ${err.message}`);
  }
};          console.warn('Failed to parse date for item:', item.title);
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
