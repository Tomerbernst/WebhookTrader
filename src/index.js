const express = require('express');
const bodyParser = require('body-parser');
const { placeOrder } = require('./interactiveBrokersClient');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Webhook endpoint
app.post('/webhook', (req, res) => {
    const { ticker, action } = req.body;

    if (!ticker || !action) {
        return res.status(400).send('Invalid webhook data');
    }

    // Buy or sell based on action from TradingView
    placeOrder(ticker, action)
        .then(() => {
            res.status(200).send('Order placed successfully');
        })
        .catch((error) => {
            console.error('Order failed:', error);
            res.status(500).send('Order failed');
        });
});

// Start the server
app.listen(PORT, () => console.log(`Proxy server listening on port ${PORT}`));
