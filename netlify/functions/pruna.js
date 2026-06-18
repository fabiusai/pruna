// netlify/functions/pruna.js

exports.handler = async function(event, context) {
    // Il proxy deve rispondere solo alle richieste POST inviate dal tuo HTML
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Metodo non consentito" };
    }

    // Recuperiamo la chiave e il modello che l'app HTML ci sta inviando
    const apiKey = event.headers['x-pruna-key'];
    const model = event.headers['x-pruna-model'] || 'p-image';

    if (!apiKey) {
        return { statusCode: 401, body: JSON.stringify({ error: "API Key mancante" }) };
    }

    try {
        // Questa è la CHIAMATA VERA verso i server di Pruna. 
        // Partendo da un server (Netlify), Pruna l'accetterà senza blocchi CORS.
        const response = await fetch('https://api.pruna.ai/v1/predictions', {
            method: 'POST',
            headers: {
                'apikey': apiKey,
                'Content-Type': 'application/json',
                'Model': model,
                'Try-Sync': 'true'
            },
            body: event.body // Inoltriamo esattamente il payload (prompt + immagine) che arriva dall'HTML
        });

        const data = await response.json();

        // Restituiamo la risposta di Pruna al nostro file HTML
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
