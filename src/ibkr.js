const { logMessage } = require('./logger');

const IB = require('ib');

const ib = new IB({
    clientId: 1001,
    host: 'localhost',
    port: 7496 // Use 7496 for live trading, 7497 for paper trading
});

let orderId = null;
let isConnected = false; // Centralized connection state
let isConnecting = false; // Prevent multiple simultaneous connections

async function initializeIBKR() {
    return new Promise((resolve, reject) => {
        if (isConnected) {
            logMessage('Already connected to IBKR API');
            return resolve(); // Skip reconnection
        }

        if (isConnecting) {
            logMessage('Connection in progress...');
            return resolve(); // Wait for ongoing connection
        }

        isConnecting = true;

        const timeout = setTimeout(() => {
            isConnecting = false;
            reject(new Error('Connection to IBKR API timed out'));
        }, 10000); // Timeout after 10 seconds

        ib.once('connected', () => {
            clearTimeout(timeout);
            logMessage('Connected to IBKR API');
            isConnected = true;
            isConnecting = false;

            // Request the next valid order ID
            ib.reqIds(1);
            ib.once('nextValidId', (id) => {
                orderId = id;
                logMessage(`Received order ID: ${orderId}`);
                resolve();
            });
        });

        ib.once('error', (err) => {
            clearTimeout(timeout);
            if (err.message.includes('Market data farm connection is OK')) {
                logMessage('Non-critical error:', err.message);
                return; // Ignore non-critical messages
            }
            console.error('Critical error during IBKR initialization:', err.message);
            isConnected = false;
            isConnecting = false;
            reject(err);
        });

        ib.once('disconnected', () => {
            logMessage('Disconnected from IBKR API');
            isConnected = false;
        });

        ib.connect();
    });
}

function placeOrder(data) {
    return new Promise((resolve, reject) => {
        if (!orderId) {
            return reject(new Error('Order ID not initialized'));
        }

        const contract = {
            symbol: data.ticker,
            secType: 'STK',
            exchange: 'SMART',
            currency: 'USD',
        };

        const order = {
            action: data.action.toUpperCase(),
            orderType: 'MKT',
            totalQuantity: parseFloat(data.position_size) || 1,
        };

        logMessage('Placing order with contract:', contract);
        logMessage('Order details:', order);

        // Place the order
        ib.placeOrder(orderId++, contract, order);

        // Respond immediately after submitting the order
        resolve({
            success: true,
            message: 'Order submitted successfully. Waiting for status updates.',
            orderId: orderId - 1,
        });

        // Handle order status updates asynchronously
        ib.on('orderStatus', (id, status, filled, remaining, avgFillPrice) => {
            logMessage(`Order Status Update: ${status}`);
            logMessage({
                orderId: id,
                status: status,
                filled: filled,
                remaining: remaining,
                avgFillPrice: avgFillPrice,
            });
        });

        // Catch errors during the process
        ib.once('error', (err) => {
            // Ignore non-critical messages
            if (err.message.includes('data farm connection is OK')) {
                console.log('Non-critical message:', err.message);
                return; // Skip processing this as an error
            }

            // Log critical errors and reject the promise
            console.error('Critical error placing order:', err.message);
            reject({
                success: false,
                message: 'Failed to place the order.',
                error: err.message,
            });
        });
    });
}

function disconnectIBKR() {
    if (ib.connected) {
        logMessage('Disconnecting from IBKR API...');
        ib.disconnect();
    } else {
        logMessage('IBKR API is not connected, no need to disconnect.');
    }
}

module.exports = {
    initializeIBKR,
    placeOrder,
    disconnectIBKR
};
