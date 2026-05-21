const { google } = require('googleapis');
const crypto = require('crypto');
const OAuthToken = require('../models/OAuthToken');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({ iv: iv.toString('hex'), data: encrypted.toString('hex'), tag: authTag.toString('hex') });
};

exports.getGoogleAuthUrl = (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'Google OAuth is not configured on the server.' });
  }
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    prompt: 'consent' // Force to get refresh_token
  });
  res.json({ url });
};

exports.handleCallback = async (req, res) => {
  const { code, state } = req.query; // we can pass userId in state or rely on frontend to call this endpoint with token?
  // Actually, usually frontend sends the code to backend
  // Let's create an endpoint that takes the code from body to avoid passing auth headers in callback redirect
  res.send('Google Auth Callback Handler. This should be a POST endpoint or handle redirect.');
};

// We'll create a POST endpoint to handle the code exchange
exports.exchangeCode = async (req, res) => {
  try {
    const { code } = req.body;
    const { tokens } = await oauth2Client.getToken(code);
    
    // We can also fetch the user's email for display
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Encrypt and store
    const encryptedToken = encrypt(JSON.stringify(tokens));

    await OAuthToken.findOneAndUpdate(
      { userId: req.user.id, provider: 'google' },
      { encryptedToken, userEmail: userInfo.data.email },
      { upsert: true, new: true }
    );

    res.json({ success: true, email: userInfo.data.email });
  } catch (error) {
    console.error('Error exchanging Google code:', error);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
};

exports.checkGoogleStatus = async (req, res) => {
  try {
    const token = await OAuthToken.findOne({ userId: req.user.id, provider: 'google' });
    if (!token) {
      return res.json({ connected: false });
    }
    res.json({ connected: true, email: token.userEmail });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check Google status' });
  }
};
