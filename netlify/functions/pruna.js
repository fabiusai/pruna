exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Metodo non consentito" };
    }

    const apiKey = event.headers['x-pruna-key'];
    const model = event.headers['x-pruna-model'] || 'p-image';

    if (!apiKey) {
        return { statusCode: 401, body: JSON.stringify({ error: "API Key mancante" }) };
    }

    try {
        // Manteniamo questa sicurezza nel caso Netlify decida comunque di codificare il payload
        let requestBody = event.body;
        if (event.isBase64Encoded) {
            requestBody = Buffer.from(event.body, 'base64').toString('utf-8');
        }

        const response = await fetch('https://api.pruna.ai/v1/predictions', {
            method: 'POST',
            headers: {
                'apikey': apiKey,
                'Content-Type': 'application/json',
                'Model': model,
                'Try-Sync': 'true'
            },
            body: requestBody
        });

        const data = await response.json();

        return {
            statusCode: response.status,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error("Errore del Proxy:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Errore di comunicazione con Pruna" })
        };
    }
};
