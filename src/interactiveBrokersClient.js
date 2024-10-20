// src/interactiveBrokersClient.js
const IB = require('ib');
const ib = new IB({ clientId: 0, host: 'localhost', port: 7497 }); // Connect to TWS or IB Gateway

function placeOrder(symbol, action) {
    return new Promise((resolve, reject) => {
        ib.connect();

        // Define the stock and action (buy/sell)
        const contract = { symbol, secType: 'STK', currency: 'USD', exchange: 'SMART' };
        const order = { action: action.toUpperCase(), orderType: 'MKT', totalQuantity: 1 }; // Market order, quantity 1

        // Submit order to IBKR
        ib.placeOrder(contract, order);
        ib.once('orderStatus', (id, status) => {
            if (status === 'Filled') {
                resolve();
            } else {
                reject(new Error('Order not filled'));
            }
        });

        ib.once('error', (err) => {
            reject(err);
        });
    });
}

module.exports = { placeOrder };
