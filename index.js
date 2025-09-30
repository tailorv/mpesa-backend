const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS to allow requests from your Netlify domain
app.use(cors({
  origin: 'https://havilahapitherapy.com',
  methods: ['GET', 'POST', 'OPTIONS'], // Explicitly allow OPTIONS
  allowedHeaders: ['Content-Type'], // Allow Content-Type header
}));

app.use(express.json());

// Generate M-Pesa Access Token
async function getAccessToken() {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  try {
    const response = await axios.get(`${process.env.MPESA_API_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Access Token Error:', error.response?.data || error.message);
    throw error;
  }
}

// Explicitly handle OPTIONS preflight for /stk-push
app.options('/stk-push', cors()); // Ensure OPTIONS is handled

// Endpoint 1: /stk-push (Initiate M-Pesa STK Push)
app.post('/stk-push', async (req, res) => {
  const { phone, amount } = req.body;
  if (!phone || !amount) {
    return res.status(400).json({ error: 'Phone and amount are required' });
  }
  const shortCode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
  const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

  try {
    const token = await getAccessToken();
    const stkPayload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: shortCode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: 'HavilahOrder',
      TransactionDesc: 'Payment for bee products'
    };
    const response = await axios.post(`${process.env.MPESA_API_BASE_URL}/mpesa/stkpush/v1/processrequest`, stkPayload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(response.data);
  } catch (error) {
    console.error('STK Push Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to initiate payment', details: error.response?.data });
  }
});

// Endpoint 2: /save-order (Save Order Details)
app.post('/save-order', (req, res) => {
  const order = req.body;
  console.log('Saved Order:', order); // Replace with database in production
  res.json({ success: true, orderId: `order-${Date.now()}` });
});

// Callback Endpoint for M-Pesa
app.post('/callback', (req, res) => {
  const { Body } = req.body;
  const { stkCallback } = Body || {};
  if (stkCallback) {
    if (stkCallback.ResultCode === 0) {
      console.log('Payment Successful:', stkCallback.CallbackMetadata);
    } else {
      console.log('Payment Failed:', stkCallback.ResultDesc);
    }
  } else {
    console.log('Invalid Callback:', req.body);
  }
  res.sendStatus(200);
});

// Health Check Endpoint
app.get('/', (req, res) => {
  res.json({ status: 'Backend is running' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));