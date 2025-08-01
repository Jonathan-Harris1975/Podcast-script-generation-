async function getWeatherSummary(dateStr) {
  const host = process.env.RAPIDAPI_HOST; // e.g. weatherapi-com.p.rapidapi.com
  const key  = process.env.RAPIDAPI_KEY;

  const url = `https://${host}/history.json?q=UK&dt=${dateStr}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': host,
      'x-rapidapi-key': key
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Weather API ${res.status}: ${text}`);
  }

  const data = await res.json();
  const day = data?.forecast?.forecastday?.[0]?.day;
  if (!day) throw new Error('Weather response missing day data');

  return `Max temp was ${day.maxtemp_c}°C, min was ${day.mintemp_c}°C, with ${day.condition.text.toLowerCase()}.`;
}

module.exports = { getWeatherSummary };
