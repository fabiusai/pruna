// Esempio semplificato di funzione Netlify
exports.handler = async (event) => {
  const response = await fetch('https://api.pruna.ai/v1/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': event.headers['x-api-key'], // La chiave viene passata dal frontend
    },
    body: event.body,
  });
  
  const data = await response.json();
  return {
    statusCode: response.status,
    body: JSON.stringify(data),
  };
};
