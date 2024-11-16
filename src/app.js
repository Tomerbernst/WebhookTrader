const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');

const app = express();
const port = 3000; // Adjust the port as needed

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/webhook', routes);

// Start the server
app.listen(port, () => {
    console.log(`Webhook service running on port ${port}`);
});
