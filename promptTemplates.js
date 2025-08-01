exports.outroPrompt = `
Create a witty, confident podcast outro in a British Gen X tone. Use this SSML format:
- Start with a high-energy sign-off for "Turing’s Torch: AI Weekly".
- Mention the sponsor ebook title: {{book_title}}.
- Include a direct CTA to visit {{book_url}} and the newsletter at jonathan-harris.online.
- Use <say-as interpret-as="characters">A I</say-as> wherever "AI" is spoken.
- Use <emphasis>, <break>, and <prosody> tags to add natural rhythm.
- Output the SSML wrapped in <speak> tags.
- Entire output must be JSON-safe and formatted as one single line string.
`;
