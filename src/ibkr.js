const IB = require('ib');
const {logMessage} = require('./logger');
const { IB_HOST, IB_PORT, IB_CLIENT_ID } = require('./config');

const ib = new IB({
    clientId: IB_CLIENT_ID,
    host: IB_HOST,
    port: IB_PORT
});
let orderId = null;
let isConnected = false;
let isConnecting = false;

async function initializeIBKR() {
    return new Promise((resolve, reject) => {
        if (isConnected) return resolve();
        if (isConnecting) return resolve();

        isConnecting = true;

        const t = setTimeout(() => {
            isConnecting = false;
            reject(new Error('Connection to IBKR API timed out'));
        }, 10000);

        ib.once('connected', () => {
            clearTimeout(t);
            isConnected = true;
            isConnecting = false;
            logMessage('Connected to IBKR API');
            ib.reqIds(1);
        });

        ib.once('nextValidId', (id) => {
            orderId = id;
            logMessage(`nextValidId: ${orderId}`);
            resolve();
        });

        ib.on('disconnected', () => {
            isConnected = false;
        });
        ib.on('error', (err) => {
            const msg = String(err?.message || err);
            if (msg.toLowerCase().includes('farm connection is ok')) return; // noise
            console.error('IBKR error:', msg);
        });

        ib.connect();
    });
}

function makeStockContract(ticker, exchange = 'SMART', currency = 'USD') {
    return {symbol: ticker, secType: 'STK', exchange, currency};
}

function makeFutureBase({ticker, month, exchange = 'CME', currency = 'USD', localSymbol, tradingClass, conId}) {
    if (conId) return {conId: Number(conId), secType: 'FUT', exchange};
    const c = {secType: 'FUT', exchange};
    if (ticker) c.symbol = ticker;
    if (currency) c.currency = currency;
    if (month) c.lastTradeDateOrContractMonth = month;
    if (localSymbol) c.localSymbol = localSymbol;
    if (tradingClass) c.tradingClass = tradingClass;
    return c;
}

function resolveFutureContract(base) {
    return new Promise((resolve, reject) => {
        const reqId = Date.now() % 2147483647;
        const found = [];

        const onDetails = (id, details) => {
            if (id === reqId) found.push(details);
        };
        const onEnd = (id) => {
            if (id !== reqId) return;
            ib.off('contractDetails', onDetails);
            ib.off('contractDetailsEnd', onEnd);

            if (!found.length) return reject(new Error('No contract found for FUT'));
            const summaries = found.map(d => d.summary).filter(Boolean);
            if (!summaries.length) return reject(new Error('Contract details received without summary'));

            const contract = summaries[0];
            contract.secType = 'FUT';
            contract.exchange = base.exchange || 'CME';
            resolve(contract);
        };

        ib.on('contractDetails', onDetails);
        ib.on('contractDetailsEnd', onEnd);
        ib.reqContractDetails(reqId, base);
    });
}

function buildOrder({action, qty, orderType = 'MKT', price, tif = 'DAY', outsideRth = false, mode = 'live'}) {
    const o = {
        action: action.toUpperCase(),
        totalQuantity: Number(qty),
        orderType: orderType.toUpperCase(),
        tif,
        outsideRth: !!outsideRth,
        transmit: true
    };
    if (o.orderType === 'LMT') {
        if (price == null) throw new Error('LMT order requires "price"');
        o.lmtPrice = Number(price);
    }

    // modes: live | stage | preview
    const m = String(mode).toLowerCase();
    if (m === 'stage') o.transmit = false;
    if (m === 'preview') {
        o.whatIf = true;
        o.transmit = true;
    }

    return o;
}

function inferAssetType(d) {
    if (d.assetType) return String(d.assetType).toUpperCase();
    if (d.month || d.expiry || d.localSymbol || d.conId) return 'FUT';
    return 'STK';
}

function previewOrder(contract, order) {
    return new Promise((resolve) => {
        const tmpId = orderId++;
        let state;

        const onOpen = (id, c, o, s) => {
            if (id === tmpId) state = s;
        };
        const onStatus = (id) => {
            if (id === tmpId) {
                cleanup();
                resolve({state});
            }
        };
        const cleanup = () => {
            ib.removeListener('openOrder', onOpen);
            ib.removeListener('orderStatus', onStatus);
        };

        ib.on('openOrder', onOpen);
        ib.on('orderStatus', onStatus);
        ib.placeOrder(tmpId, contract, {...order, whatIf: true, transmit: true});
    });
}

async function placeOrder(data) {
    if (!orderId) throw new Error('Order ID not initialized (call initializeIBKR first)');

    const action = String(data.action || '').toUpperCase();
    const qty = Number(data.position_size || 1);
    const orderType = (data.orderType || 'MKT').toUpperCase();
    const price = data.price != null ? Number(data.price) : undefined;
    const outsideRth = Boolean(data.outsideRth);
    const mode = data.mode || 'live'; // 'live' | 'stage' | 'preview'

    if (!['BUY', 'SELL'].includes(action)) throw new Error('Invalid action (BUY/SELL)');
    if (!data.ticker) throw new Error('ticker required');
    if (!(qty > 0)) throw new Error('position_size must be > 0');

    const assetType = inferAssetType(data);
    let contract;

    if (assetType === 'FUT') {
        const base = makeFutureBase({
            ticker: data.ticker,
            month: data.month || data.expiry,
            exchange: data.exchange || 'CME',
            currency: data.currency || 'USD',
            localSymbol: data.localSymbol,
            tradingClass: data.tradingClass || data.ticker,
            conId: data.conId
        });
        contract = base.conId ? base : await resolveFutureContract(base);
    } else {
        const sym = String(data.ticker).split(':').pop();
        contract = makeStockContract(sym, data.exchange || 'SMART', data.currency || 'USD');
    }

    const order = buildOrder({action, qty, orderType, price, tif: data.tif || 'DAY', outsideRth, mode});

    if (String(mode).toLowerCase() === 'preview') {
        const {state = {}} = await previewOrder(contract, order);
        return {success: true, mode: 'preview', state};
    }

    const thisOrderId = orderId++;
    if (String(mode).toLowerCase() === 'stage') {
        ib.placeOrder(thisOrderId, contract, order);
        return {success: true, mode: 'stage', orderId: thisOrderId};
    }

    return new Promise((resolve, reject) => {
        const onStatus = (id, status, filled, remaining, avgFillPrice) => {
            if (id !== thisOrderId) return;
            logMessage(`Order ${id} status: ${status} filled=${filled} remaining=${remaining} avg=${avgFillPrice}`);
            if (['Filled', 'Cancelled', 'Inactive', 'Rejected'].includes(status)) {
                ib.removeListener('orderStatus', onStatus);
                resolve({success: status === 'Filled', orderId: id, status, avgFillPrice});
            }
        };
        ib.on('orderStatus', onStatus);

        try {
            ib.placeOrder(thisOrderId, contract, order);
        } catch (e) {
            ib.removeListener('orderStatus', onStatus);
            reject(e);
        }
    });
}

function disconnectIBKR() {
    if (ib.connected) {
        logMessage('Disconnecting from IBKR API...');
        ib.disconnect();
    } else {
        logMessage('IBKR API is not connected.');
    }
}

module.exports = {
    initializeIBKR,
    placeOrder,
    disconnectIBKR
};
