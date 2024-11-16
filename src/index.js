const express = require('express');
const bodyParser = require('body-parser');
const IB = require('ib');

const app = express();
const port = 3000; // Adjust the port as needed

app.use(bodyParser.json()); // Middleware to parse JSON requests

const ib = new IB({
    clientId: 1001,       // Unique ID for this client
    host: 'localhost',    // TWS/IB Gateway host
    port: 7496            // Use 7496 for live trading, 7497 for paper trading
});

let orderId = null; // Track order ID

// Initialize the IBKR connection
function initializeIBKR() {
    return new Promise((resolve, reject) => {
        ib.once('connected', () => {
            console.log('Connected to IBKR API');
            ib.reqIds(1); // Request the next valid order ID
            ib.once('nextValidId', (id) => {
                orderId = id;
                console.log(`Received order ID: ${orderId}`);
                resolve();
            });
        });

        ib.once('error', (err) => {
            console.error('Error during IBKR initialization:', err.message);
            reject(err);
        });

        ib.connect();
    });
}

// Function to place an order
function placeOrder(data) {
    return new Promise((resolve, reject) => {
        if (!orderId) {
            return reject(new Error('Order ID not initialized'));
        }

        const contract = {
            symbol: data.ticker,
            secType: 'STK',
            exchange: 'SMART',
            currency: 'USD'
        };

        const order = {
            action: data.action.toUpperCase(),
            orderType: 'MKT',
            totalQuantity: parseFloat(data.position_size) || 1
        };

        console.log('Placing order with contract:', contract);
        console.log('Order details:', order);

        ib.placeOrder(orderId++, contract, order);

        ib.once('orderStatus', (id, status, filled, remaining, avgFillPrice) => {
            console.log(`Order Status: ${status}`);
            if (status === 'Filled') {
                resolve(`Order filled. Filled: ${filled}, Avg Price: ${avgFillPrice}`);
            } else {
                reject(new Error(`Order not filled: ${status}`));
            }
        });

        ib.once('error', (err) => {
            console.error('Error placing order:', err.message);
            reject(err);
        });
    });
}

// Webhook endpoint
app.post('/webhook', async (req, res) => {
    const data = req.body;

    if (!data.ticker || !data.action || !data.position_size) {
        console.error('Invalid payload received:', data);
        return res.status(400).send('Invalid payload. Ensure all fields are provided: ticker, action, position_size.');
    }

    try {
        if (!ib.connected) {
            console.log('Connecting to IBKR API...');
            await initializeIBKR();
        }
        const result = await placeOrder(data);
        console.log('Order result:', result);
        res.status(200).send(result);
    } catch (error) {
        console.error('Error processing webhook:', error.message);
        res.status(500).send('Failed to place order');
    } finally {
        if (ib.connected) {
            console.log('Disconnecting from IBKR API...');
            ib.disconnect();
        }
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Webhook service running on port ${port}`);
});
