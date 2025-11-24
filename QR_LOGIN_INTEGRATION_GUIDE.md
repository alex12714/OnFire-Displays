# OnFire QR Code Login Integration Guide

Complete guide to integrate QR code login functionality into any OnFire web application.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Implementation Steps](#implementation-steps)
5. [API Integration](#api-integration)
6. [Styling](#styling)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This integration adds a **QR Code Login** feature to your OnFire web application, allowing users to:
- Scan a QR code with their mobile app
- Automatically log in to the web app without typing credentials
- Experience real-time status polling and automatic redirect

### Features Implemented:
✅ Tabbed login interface (Email/Password + QR Code)  
✅ QR code generation with 15-second expiration  
✅ Real-time status polling (every 2 seconds)  
✅ Countdown timer display  
✅ Expired state with visual feedback (40% opacity + reload icon)  
✅ Click-to-refresh functionality  
✅ Automatic JWT token storage and redirect  

---

## 📦 Prerequisites

### Required:
- React application (v16.8+ for hooks support)
- `react-router-dom` for navigation
- OnFire API access (`https://api2.onfire.so`)
- Node.js and npm/yarn

### API Endpoints Used:
- `POST /rpc/generate_qr_session` - Generates QR code
- `POST /rpc/check_qr_status` - Polls for confirmation
- `POST /rpc/confirm_qr_login` - Mobile app confirms (handled by mobile)

---

## 🚀 Installation

### Step 1: Install Dependencies

```bash
npm install qrcode
# or
yarn add qrcode
```

### Step 2: Verify React Router

Ensure `react-router-dom` is installed:

```bash
npm install react-router-dom
# or
yarn add react-router-dom
```

---

## 🔧 Implementation Steps

### Step 1: Update Login Component

Replace or modify your existing `Login.js` component:

```javascript
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import './Login.css';

const Login = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState('email');
  
  // Email/Password states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // QR Code states
  const [qrCode, setQrCode] = useState(null);
  const [qrStatus, setQrStatus] = useState('generating');
  const [qrMessage, setQrMessage] = useState('Generating QR code...');
  const [timeRemaining, setTimeRemaining] = useState(null);
  
  // Refs for QR functionality
  const canvasRef = useRef(null);
  const pollingRef = useRef(null);
  const timerRef = useRef(null);
  const expiresAtRef = useRef(null);
  const qrCodeRef = useRef(null); // IMPORTANT: Prevents stale closure
  
  const navigate = useNavigate();

  // Email/Password login handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // YOUR EXISTING LOGIN LOGIC HERE
      const result = await yourLoginAPI(email, password);
      
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // QR Code Functions
  const getClientIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return '0.0.0.0';
    }
  };

  const generateQRSession = async () => {
    try {
      setQrStatus('generating');
      setQrMessage('Generating QR code...');
      
      const response = await fetch('https://api2.onfire.so/rpc/generate_qr_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_ip_address: await getClientIP(),
          p_user_agent: navigator.userAgent
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ QR Session generated:', data);
        
        setQrCode(data.qr_code);
        qrCodeRef.current = data.qr_code; // Store in ref
        
        // Set expiration to 15 seconds (or customize)
        const customExpiration = new Date(Date.now() + 15 * 1000);
        expiresAtRef.current = customExpiration;
        
        await displayQRCode(data.qr_code);
        startPolling();
        setQrStatus('waiting');
        setQrMessage('Waiting for mobile app to scan...');
      } else {
        throw new Error('Failed to generate QR session');
      }
    } catch (error) {
      console.error('❌ Error generating QR:', error);
      setQrStatus('error');
      setQrMessage('Error generating QR code. Please refresh.');
    }
  };

  const displayQRCode = async (code) => {
    if (canvasRef.current) {
      try {
        await QRCode.toCanvas(canvasRef.current, code, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' }
        });
      } catch (error) {
        console.error('Error displaying QR code:', error);
      }
    }
  };

  const startPolling = () => {
    console.log('🔄 Starting QR status polling...');
    checkQRStatus(); // Call immediately
    pollingRef.current = setInterval(checkQRStatus, 2000); // Then every 2 seconds
    startTimer();
  };

  const startTimer = () => {
    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
  };

  const updateTimer = () => {
    if (!expiresAtRef.current) return;
    
    const now = new Date();
    const remaining = Math.max(0, expiresAtRef.current - now);
    const seconds = Math.floor(remaining / 1000);
    
    if (seconds > 0) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setTimeRemaining(`${minutes}:${secs.toString().padStart(2, '0')}`);
    } else {
      setTimeRemaining(null);
      handleQRExpired();
    }
  };

  const checkQRStatus = async () => {
    const currentQrCode = qrCodeRef.current;
    console.log('🔍 Checking QR status:', currentQrCode);
    
    if (!currentQrCode) return;
    
    try {
      const response = await fetch('https://api2.onfire.so/rpc/check_qr_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_qr_code: currentQrCode })
      });

      const data = await response.json();
      console.log('📡 QR Status Response:', data);
      
      if (!data || !data.success) {
        console.error('❌ Invalid response');
        return;
      }
      
      if (data.status === 'confirmed' && data.jwt_token) {
        console.log('✅ QR Code confirmed!');
        stopPolling();
        handleQRSuccess(data.jwt_token);
      } else if (data.status === 'expired') {
        console.log('⏰ QR Code expired');
        stopPolling();
        handleQRExpired();
      } else if (data.status === 'pending') {
        console.log('⏳ Still pending...');
      }
    } catch (error) {
      console.error('❌ Status check error:', error);
    }
  };

  const handleQRSuccess = async (jwtToken) => {
    console.log('🎉 QR Login successful!');
    setQrStatus('success');
    setQrMessage('✅ Login successful! Redirecting...');
    
    try {
      // Store tokens
      localStorage.setItem('onfire_access_token', jwtToken);
      localStorage.setItem('onfire_refresh_token', jwtToken);
      
      // Fetch user data
      const userResponse = await fetch('https://api2.onfire.so/users?select=id,email,username,first_name,last_name', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (userResponse.ok) {
        const users = await userResponse.json();
        if (users && users.length > 0) {
          localStorage.setItem('onfire_user_data', JSON.stringify(users[0]));
        }
      }
      
      // Redirect to dashboard
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (error) {
      console.error('Error storing user data:', error);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    }
  };

  const handleQRExpired = () => {
    setQrStatus('expired');
    setQrMessage('');
    setTimeRemaining(null);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const refreshQRCode = () => {
    stopPolling();
    setQrCode(null);
    qrCodeRef.current = null;
    setTimeRemaining(null);
    generateQRSession();
  };

  // Initialize QR code when tab is switched
  useEffect(() => {
    if (activeTab === 'qr' && !qrCode) {
      generateQRSession();
    }
    
    return () => {
      if (activeTab !== 'qr') {
        stopPolling();
      }
    };
  }, [activeTab]);

  return (
    <div className="login-container">
      <div className="login-content">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">Welcome Back</h1>
            <p className="login-subtitle">Sign in to access your account</p>
          </div>

          <div className="login-body">
            {/* Tab Navigation */}
            <div className="login-tabs">
              <button
                className={`tab-button ${activeTab === 'email' ? 'active' : ''}`}
                onClick={() => setActiveTab('email')}
              >
                📧 Email
              </button>
              <button
                className={`tab-button ${activeTab === 'qr' ? 'active' : ''}`}
                onClick={() => setActiveTab('qr')}
              >
                📱 QR Code
              </button>
            </div>

            {/* Email/Password Tab */}
            {activeTab === 'email' && (
              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                {error && (
                  <div className="error-message">{error}</div>
                )}
                <button type="submit" className="login-button" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            )}

            {/* QR Code Tab */}
            {activeTab === 'qr' && (
              <div className="qr-login-container">
                <div 
                  className={`qr-code-wrapper ${qrStatus === 'expired' ? 'expired' : ''}`}
                  onClick={qrStatus === 'expired' ? refreshQRCode : undefined}
                  style={{ cursor: qrStatus === 'expired' ? 'pointer' : 'default' }}
                >
                  <canvas ref={canvasRef} id="qr-canvas"></canvas>
                  {qrStatus === 'expired' && (
                    <div className="reload-overlay">
                      <div className="reload-icon">🔄</div>
                    </div>
                  )}
                  {timeRemaining && qrStatus !== 'expired' && (
                    <div className="qr-timer">Expires in {timeRemaining}</div>
                  )}
                </div>
                
                <div className={`qr-status-message ${qrStatus}`}>
                  {qrStatus === 'waiting' && <span className="loading-spinner"></span>}
                  {qrStatus !== 'expired' && qrMessage}
                </div>

                <div className="qr-instructions">
                  <h3>How to login:</h3>
                  <ol>
                    <li>Open <strong>OnFire app</strong> on your phone</li>
                    <li>Go to <strong>Settings</strong></li>
                    <li>Tap <strong>"Login on Web"</strong></li>
                    <li>Scan this QR code</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
```

---

## 🎨 Styling

Create or update your `Login.css` file:

```css
/* Container */
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-content {
  width: 100%;
  max-width: 450px;
}

.login-card {
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.login-header {
  padding: 40px 40px 20px;
  text-align: center;
}

.login-title {
  font-size: 28px;
  color: #333;
  margin-bottom: 10px;
}

.login-subtitle {
  color: #666;
  font-size: 14px;
}

.login-body {
  padding: 0 40px 40px;
}

/* Tab Navigation */
.login-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 25px;
  border-bottom: 2px solid #e5e7eb;
}

.tab-button {
  flex: 1;
  padding: 12px 20px;
  background: transparent;
  border: none;
  color: #999;
  font-size: 1em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border-bottom: 3px solid transparent;
  position: relative;
  bottom: -2px;
}

.tab-button:hover {
  color: #667eea;
}

.tab-button.active {
  color: #667eea;
  border-bottom-color: #667eea;
}

/* Email/Password Form */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  color: #333;
  font-weight: 600;
  font-size: 14px;
}

.form-group input {
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1em;
  transition: border-color 0.3s ease;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.error-message {
  padding: 12px;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.9em;
  text-align: center;
}

.login-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 700;
  font-size: 1.1em;
  padding: 14px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.login-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5);
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* QR Code Container */
.qr-login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px 0;
}

.qr-code-wrapper {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 15px;
  padding: 20px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  position: relative;
  transition: opacity 0.3s ease;
}

.qr-code-wrapper.expired {
  opacity: 0.4;
}

.qr-code-wrapper.expired:hover {
  opacity: 0.6;
}

#qr-canvas {
  border-radius: 10px;
  display: block;
}

.reload-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  pointer-events: none;
}

.reload-icon {
  font-size: 64px;
  animation: pulse 1.5s ease-in-out infinite;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}

.qr-timer {
  font-size: 14px;
  color: #666;
  font-weight: 600;
}

.qr-status-message {
  font-size: 16px;
  color: #666;
  text-align: center;
  min-height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.3s ease;
}

.qr-status-message.success {
  color: #10b981;
  font-weight: 600;
}

.qr-status-message.error {
  color: #ef4444;
  font-weight: 600;
}

.loading-spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 3px solid rgba(102, 126, 234, 0.3);
  border-radius: 50%;
  border-top-color: #667eea;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.qr-instructions {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
  width: 100%;
}

.qr-instructions h3 {
  font-size: 18px;
  color: #333;
  margin-bottom: 15px;
  text-align: center;
}

.qr-instructions ol {
  color: #666;
  padding-left: 20px;
  line-height: 1.8;
}

.qr-instructions li {
  margin-bottom: 8px;
}

.qr-instructions strong {
  color: #667eea;
}
```

---

## 🔌 API Integration

### Required API Endpoints

#### 1. Generate QR Session

**Endpoint:** `POST https://api2.onfire.so/rpc/generate_qr_session`

**Request:**
```json
{
  "p_ip_address": "192.168.1.1",
  "p_user_agent": "Mozilla/5.0..."
}
```

**Response:**
```json
{
  "success": true,
  "session_id": "uuid",
  "qr_code": "encoded_string",
  "expires_at": "2025-11-24T20:35:25.443974+00:00"
}
```

#### 2. Check QR Status

**Endpoint:** `POST https://api2.onfire.so/rpc/check_qr_status`

**Request:**
```json
{
  "p_qr_code": "encoded_string"
}
```

**Response (Pending):**
```json
{
  "success": true,
  "status": "pending",
  "expires_at": "2025-11-24T20:35:25.443974+00:00"
}
```

**Response (Confirmed):**
```json
{
  "success": true,
  "status": "confirmed",
  "jwt_token": "eyJhbGc...",
  "confirmed_at": "2025-11-24T20:30:45.123456+00:00"
}
```

---

## ⚙️ Configuration

### Adjust Expiration Time

Change the expiration duration in `generateQRSession`:

```javascript
// 15 seconds
const customExpiration = new Date(Date.now() + 15 * 1000);

// 30 seconds
const customExpiration = new Date(Date.now() + 30 * 1000);

// 1 minute
const customExpiration = new Date(Date.now() + 60 * 1000);

// 5 minutes (API default)
const customExpiration = new Date(data.expires_at);
```

### Adjust Polling Interval

Change polling frequency in `startPolling`:

```javascript
// Every 2 seconds (recommended)
pollingRef.current = setInterval(checkQRStatus, 2000);

// Every 1 second (faster, more API calls)
pollingRef.current = setInterval(checkQRStatus, 1000);

// Every 5 seconds (slower, fewer API calls)
pollingRef.current = setInterval(checkQRStatus, 5000);
```

---

## 🧪 Testing

### Manual Testing Steps

1. **Generate QR Code:**
   - Open web app
   - Click "📱 QR Code" tab
   - Verify QR code displays with timer

2. **Test Polling:**
   - Open browser DevTools (F12) → Console
   - Watch for polling logs:
     ```
     📡 QR Status Response: {status: "pending"}
     ⏳ Still pending...
     ```

3. **Test Expiration:**
   - Wait 15 seconds
   - Verify QR code fades to 40% opacity
   - Verify reload icon (🔄) appears
   - Click to refresh

4. **Test Login Flow:**
   - Scan QR code with mobile app
   - Mobile app calls `/rpc/confirm_qr_login`
   - Web app should detect and redirect within 2 seconds

### Automated Testing with curl

```bash
# Step 1: Generate QR code
QR_CODE=$(curl -s -X POST "https://api2.onfire.so/rpc/generate_qr_session" \
  -H "Content-Type: application/json" \
  -d '{"p_ip_address": "192.168.1.1", "p_user_agent": "Test"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['qr_code'])")

echo "QR Code: $QR_CODE"

# Step 2: Check status (should be pending)
curl -s -X POST "https://api2.onfire.so/rpc/check_qr_status" \
  -H "Content-Type: application/json" \
  -d "{\"p_qr_code\": \"$QR_CODE\"}"

# Step 3: Simulate mobile confirmation (need JWT token)
curl -s -X POST "https://api2.onfire.so/rpc/confirm_qr_login" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d "{\"p_qr_code\": \"$QR_CODE\"}"

# Step 4: Check status again (should be confirmed)
curl -s -X POST "https://api2.onfire.so/rpc/check_qr_status" \
  -H "Content-Type: application/json" \
  -d "{\"p_qr_code\": \"$QR_CODE\"}"
```

---

## 🐛 Troubleshooting

### Issue: QR Code Not Displaying

**Solution:**
- Check canvas ref is properly set: `<canvas ref={canvasRef} />`
- Verify `qrcode` package is installed
- Check console for errors

### Issue: Polling Not Working (qrCode is null)

**Cause:** React stale closure issue

**Solution:**
```javascript
// ❌ WRONG: State gets stale in setInterval
const checkQRStatus = async () => {
  if (!qrCode) return; // This is always null!
  // ...
};

// ✅ CORRECT: Use ref
const qrCodeRef = useRef(null);
const checkQRStatus = async () => {
  const currentQrCode = qrCodeRef.current;
  if (!currentQrCode) return;
  // ...
};
```

### Issue: QR Code Not Expiring

**Check:**
1. Timer is running: Look for `setInterval(updateTimer, 1000)`
2. Expiration is set: `expiresAtRef.current` is not null
3. Check console logs for timer updates

### Issue: Login Not Working After Scan

**Debug Steps:**
1. Open DevTools Console
2. Watch for: `📡 QR Status Response: {status: "confirmed"}`
3. Check if JWT token is received
4. Verify localStorage has `onfire_access_token`

**Common Issues:**
- Mobile app not calling `/rpc/confirm_qr_login`
- JWT token format incorrect
- CORS issues with API

---

## 📝 Best Practices

### 1. Error Handling
Always wrap API calls in try-catch:
```javascript
try {
  const response = await fetch(...);
  const data = await response.json();
  // Handle response
} catch (error) {
  console.error('Error:', error);
  setQrStatus('error');
  setQrMessage('Something went wrong. Please try again.');
}
```

### 2. Cleanup on Unmount
Always stop polling when component unmounts:
```javascript
useEffect(() => {
  if (activeTab === 'qr' && !qrCode) {
    generateQRSession();
  }
  
  return () => {
    stopPolling(); // Cleanup
  };
}, [activeTab]);
```

### 3. Security
- Never expose JWT tokens in console logs in production
- Use HTTPS for all API calls
- Validate QR codes on backend

### 4. User Experience
- Show clear status messages
- Provide visual feedback (loading spinners, animations)
- Allow easy refresh on expiration
- Display countdown timer

---

## 🎯 Customization Options

### Change Theme Colors

Update CSS variables:
```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #10b981;
  --error-color: #ef4444;
}
```

### Modify QR Code Size

```javascript
await QRCode.toCanvas(canvasRef.current, code, {
  width: 400, // Change from 300 to 400
  margin: 3,  // Change margin
  color: { 
    dark: '#667eea',  // Custom QR code color
    light: '#FFFFFF' 
  }
});
```

### Add Loading State

```javascript
if (qrStatus === 'generating') {
  return (
    <div className="qr-loading">
      <div className="spinner"></div>
      <p>Generating QR code...</p>
    </div>
  );
}
```

---

## 📚 Additional Resources

- **OnFire API Documentation:** [Contact OnFire team]
- **QR Code Library:** https://github.com/soldair/node-qrcode
- **React Hooks Guide:** https://react.dev/reference/react

---

## ✅ Checklist

Before going to production:

- [ ] QR code generates successfully
- [ ] Timer counts down correctly
- [ ] Polling works (check console logs)
- [ ] Expired state shows correctly
- [ ] Refresh works on expired QR
- [ ] Login succeeds after mobile scan
- [ ] JWT token is stored correctly
- [ ] Redirect to dashboard works
- [ ] Mobile responsiveness tested
- [ ] Error handling implemented
- [ ] Console logs removed (production)
- [ ] HTTPS enabled for all API calls

---

## 🆘 Support

If you encounter issues:

1. Check browser console for errors
2. Verify API responses match expected format
3. Test with curl commands
4. Review this guide's troubleshooting section

**Need help?** Contact the OnFire development team.

---

**Last Updated:** November 24, 2025  
**Version:** 1.0  
**Author:** Emergent AI Agent
