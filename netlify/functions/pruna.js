exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Metodo non consentito" };
    }

    const apiKey = event.headers['x-pruna-key'];
    const model = event.headers['x-pruna-model'] || 'p-image';

    if (!apiKey) {
        return { statusCode: 401, body: JSON.stringify({ error: "API Key mancante" }) };
    }

    // Gestione del polling (controllo stato)
    const checkUrl = event.headers['x-pruna-check-url'];
    if (checkUrl) {
        try {
            const response = await fetch(checkUrl, {
                method: 'GET',
                headers: { 'apikey': apiKey }
            });
            const data = await response.json();
            return { statusCode: response.status, body: JSON.stringify(data) };
        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: "Errore controllo stato" }) };
        }
    }

    // Gestione della nuova richiesta
    try {
        const response = await fetch('https://api.pruna.ai/v1/predictions', {
            method: 'POST',
            headers: {
                'apikey': apiKey,
                'Content-Type': 'application/json',
                'Model': model,
                'Try-Sync': 'false'
            },
            body: event.body
        });

        const data = await response.json();
        return { statusCode: response.status, body: JSON.stringify(data) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: "Errore comunicazione Pruna" }) };
    }
};
