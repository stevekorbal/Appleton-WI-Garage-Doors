export default async function handler(req: any, res: any) {
  // Enforce POST method only
  if (req.method !== 'POST') {
    if (res.setHeader) {
      res.setHeader('Allow', ['POST']);
    }
    return res.status(405).json({
      success: false,
      message: 'Method Not Allowed'
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid JSON payload'
        });
      }
    }

    if (!body || typeof body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Request body must be a JSON object'
      });
    }

    const {
      name,
      phone,
      email = '',
      city,
      service,
      serviceNeeded,
      message = '',
      hp_field,
      hp_address
    } = body;

    // Honeypot spam verification
    if (hp_field || hp_address) {
      return res.status(400).json({
        success: false,
        message: 'Spam detected'
      });
    }

    // Server-side data sanitization and length bounds
    const cleanName = (typeof name === 'string' ? name.trim() : '').slice(0, 150);
    const cleanPhone = (typeof phone === 'string' ? phone.trim() : '').slice(0, 50);
    const cleanEmail = (typeof email === 'string' ? email.trim() : '').slice(0, 150);
    const cleanCity = (typeof city === 'string' ? city.trim() : '').slice(0, 100);
    const rawService = service || serviceNeeded || '';
    const cleanService = (typeof rawService === 'string' ? rawService.trim() : '').slice(0, 150);
    const cleanMessage = (typeof message === 'string' ? message.trim() : '').slice(0, 3000);

    // Validation checks
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid full name.'
      });
    }

    if (!cleanPhone || cleanPhone.length < 7) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number.'
      });
    }

    if (!cleanCity) {
      return res.status(400).json({
        success: false,
        message: 'Please select your city or location.'
      });
    }

    if (!cleanService) {
      return res.status(400).json({
        success: false,
        message: 'Please select the service needed.'
      });
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    // Google Sheets Webhook URL from environment variable or fallback
    const webhookUrl =
      process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
      'https://script.google.com/macros/s/AKfycbz0v3r0fYvggUx5qGUFUgqIyRopT687iE_wZqYqCvtAWNTEKtA0ovub2yp60GiQTMh0/exec';

    // Payload strictly matching the required Google Apps Script format
    const payload = {
      sheet: 'Appleton',
      website: 'appletongaragerepair.com',
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      city: cleanCity,
      service: cleanService,
      message: cleanMessage
    };

    const googleRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!googleRes.ok) {
      console.error('[Google Sheets API Error] Status:', googleRes.status);
      return res.status(502).json({
        success: false,
        message: "Sorry, we couldn't send your request. Please call us directly."
      });
    }

    const resText = await googleRes.text();
    let resData: any = {};
    try {
      resData = JSON.parse(resText);
    } catch {
      // If response is not JSON, check HTTP ok status
    }

    if (resData.success === false || resData.status === 'error') {
      console.error('[Google Sheets Response Error]:', resData);
      return res.status(502).json({
        success: false,
        message: "Sorry, we couldn't send your request. Please call us directly."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Thank you. Your request has been received. We'll be in touch shortly."
    });
  } catch (error: any) {
    console.error('[/api/contact Exception]:', error);
    return res.status(500).json({
      success: false,
      message: "Sorry, we couldn't send your request. Please call us directly."
    });
  }
}
