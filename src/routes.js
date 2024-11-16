const express = require('express');
const { initializeIBKR, placeOrder } = require('./ibkr');
const { logMessage } = require('./logger');

const router = express.Router();


router.post('/', async (req, res) => {
    const data = req.body;

    logMessage(`Received request: ${JSON.stringify(data)}`);

    if (!data.ticker || !data.action || !data.position_size) {
        const errorMessage = 'Invalid payload received';
        logMessage(errorMessage);
        return res.status(400).send({
            success: false,
            message: errorMessage,
        });
    }

    try {
        logMessage('Initializing IBKR connection...');
        await initializeIBKR();

        const result = await placeOrder(data);
        logMessage(`Order result: ${JSON.stringify(result)}`);
        res.status(200).send(result);
    } catch (error) {
        logMessage(`Error processing webhook: ${error.message}`);
        res.status(500).send({
            success: false,
            message: error.message || 'Failed to process the request.',
        });
    }
});

module.exports = router;
