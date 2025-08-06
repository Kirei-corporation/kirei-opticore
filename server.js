const express = require('express');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// In-memory stores for clients, tokens and services
const clients = {};
const tokens = {};
let nextClientId = 1;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static files from root (HTML, CSS, JS, images)
app.use(express.static(__dirname));

/*
 * Authentication middleware (very simple for demo purposes). Expects a header
 * Authorization: Bearer <token>. Assigns req.user if token is valid.
 */
function auth(requiredRole) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    const session = tokens[token];
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (requiredRole && session.role !== requiredRole) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = session;
    next();
  };
}

// Generate a pseudo-random token
function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

// Login endpoint (demo). Accepts email and role ('client' or 'admin'). Returns token.
app.post('/api/login', (req, res) => {
  const { email, role, clientId } = req.body;
  if (!email || !role) {
    return res.status(400).json({ error: 'email and role are required' });
  }
  // In real life, validate email and role, send OTP, etc.
  const token = generateToken();
  tokens[token] = { email, role, clientId: clientId || null };
  res.json({ token, role });
});

// Create a subscription (mock, no real payment). Public endpoint.
app.post('/api/subscribe', (req, res) => {
  const { name, plan } = req.body;
  if (!name || !plan) {
    return res.status(400).json({ error: 'name and plan are required' });
  }
  const clientId = nextClientId++;
  clients[clientId] = {
    id: clientId,
    name,
    plan,
    status: 'active',
    services: {
      telegram_bot: true,
      whatsapp_bot: plan !== 'START' ? true : false,
      make_scenario: true,
      crm_integration: plan !== 'START' ? true : false,
    },
    subscriptionDate: new Date().toISOString(),
  };
  res.json({ message: 'Subscription created', clientId });
});

// Dashboard data for client (requires client role)
app.get('/api/dashboard/:id', auth('client'), (req, res) => {
  const { id } = req.params;
  if (+id !== +req.user.clientId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const client = clients[id];
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json({
    client,
    metrics: {
      leadsProcessed: Math.floor(Math.random() * 1000),
      messagesProcessed: Math.floor(Math.random() * 500),
      daysUntilRenewal: 5,
    },
  });
});

// Toggle a service for a client (client role) Body: { service: 'telegram_bot', enabled: true }
app.post('/api/clients/:id/service', auth('client'), (req, res) => {
  const { id } = req.params;
  if (+id !== +req.user.clientId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const client = clients[id];
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const { service, enabled } = req.body;
  if (!service || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'service and enabled are required' });
  }
  if (!(service in client.services)) {
    return res.status(400).json({ error: 'Unknown service' });
  }
  client.services[service] = enabled;
  res.json({ message: 'Service updated', services: client.services });
});

// Pause or resume a client (admin role)
app.post('/api/admin/clients/:id/:action', auth('admin'), (req, res) => {
  const { id, action } = req.params;
  const client = clients[id];
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (action === 'pause') {
    client.status = 'paused';
  } else if (action === 'resume') {
    client.status = 'active';
  } else {
    return res.status(400).json({ error: 'Invalid action' });
  }
  res.json({ message: `Client ${action}d`, client });
});

// List all clients (admin role)
app.get('/api/admin/clients', auth('admin'), (req, res) => {
  res.json({ clients: Object.values(clients) });
});

app.listen(PORT, () => {
  console.log(`KIREI OptiCore mock server listening on port ${PORT}`);
});