import fetch from 'node-fetch';

export const getWeatherSummary = async (dateStr) => {
  const url = `https://${process.env.RAPIDAPI_HOST}/history.json?q=UK&dt=${dateStr}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': process.env.RAPIDAPI_HOST,
      'x-rapidapi-key': process.env.RAPIDAPI_KEY
    }
  });

  const data = await res.json();
  const day = data.forecast.forecastday[0].day;

  return `Max temp was ${day.maxtemp_c}°C, min was ${day.mintemp_c}°C, with ${day.condition.text.toLowerCase()}.`;
};
