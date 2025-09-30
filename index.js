const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors({ origin: 'https://www.havilahapitherapy.com' }));

// Generate M-Pesa Access Token
async function getAccessToken() {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const response = await axios.get(`${process.env.MPESA_API_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }
  });
  return response.data.access_token;
}

// STK Push Endpoint
app.post('/stk-push', async (req, res) => {
  const { phone, amount } = req.body;
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
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// Callback Endpoint
app.post('/callback', (req, res) => {
  const { Body } = req.body;
  const { stkCallback } = Body;
  if (stkCallback.ResultCode === 0) {
    console.log('Payment Successful:', stkCallback.CallbackMetadata);
  } else {
    console.log('Payment Failed:', stkCallback.ResultDesc);
  }
  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));