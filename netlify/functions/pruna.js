exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Metodo non consentito" };
    }

    const apiKey = event.headers['x-pruna-key'];
    const model = event.headers['x-pruna-model'] || 'p-image'; // Fallback di sicurezza

    if (!apiKey) {
        return { statusCode: 401, body: JSON.stringify({ error: "API Key mancante" }) };
    }

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

    try {
        const response = await fetch('https://api.pruna.ai/v1/predictions', {
            method: 'POST',
            headers: {
                'apikey': apiKey,
                'Content-Type': 'application/json',
                'Model': model, // Assicurato il passaggio del modello corretto
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
