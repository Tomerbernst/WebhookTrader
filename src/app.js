const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');

const app = express();
const port = 3000;

app.use(bodyParser.json());

app.use('/webhook', routes);

app.listen(port, () => {
    console.log(`Webhook service running on port ${port}`);
});
