export default function splitSSML(input, limit = 4800) {
  const cleaned = input.replace(/<\/speak>/g, '').replace(/<speak>/g, '');
  const sentences = cleaned.split(/(?<=[.?!])\s+/);

  const chunks = [];
  let buffer = '';

  for (let sentence of sentences) {
    if ((buffer + sentence).length > limit) {
      chunks.push(`<speak>${buffer.trim()}</speak>`);
      buffer = sentence + ' ';
    } else {
      buffer += sentence + ' ';
    }
  }

  if (buffer.trim()) {
    chunks.push(`<speak>${buffer.trim()}</speak>`);
  }

  return chunks;
}