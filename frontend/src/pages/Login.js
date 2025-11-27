import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import QRCode from 'qrcode';
import onFireAPI from '../services/api';
import './Login.css';

const Login = () => {
  const [activeTab, setActiveTab] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  // QR Code states
  const [qrCode, setQrCode] = useState(null);
  const [qrStatus, setQrStatus] = useState('generating');
  const [qrMessage, setQrMessage] = useState('Generating QR code...');
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showDisplayModal, setShowDisplayModal] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const canvasRef = useRef(null);
  const pollingRef = useRef(null);
  const timerRef = useRef(null);
  const expiresAtRef = useRef(null);
  const qrCodeRef = useRef(null); // Use ref to avoid stale closure

  // Email/Password login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await onFireAPI.login(email, password);
      
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // QR Code functions
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
        console.log('📱 QR Code:', data.qr_code);
        console.log('⏰ API Expires at:', data.expires_at);
        
        setQrCode(data.qr_code);
        qrCodeRef.current = data.qr_code; // Store in ref for polling
        
        // Override expiration to 15 seconds from now (instead of API's 5 minutes)
        const customExpiration = new Date(Date.now() + 15 * 1000); // 15 seconds
        expiresAtRef.current = customExpiration;
        console.log('⏰ Custom expiration set to 15 seconds:', customExpiration);
        
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
    console.log('🔄 Starting QR status polling (every 2 seconds)...');
    // Call immediately first time
    checkQRStatus();
    // Then poll every 2 seconds
    pollingRef.current = setInterval(checkQRStatus, 2000);
    
    // Start timer countdown
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
    console.log('🔍 checkQRStatus called, qrCode:', currentQrCode);
    
    if (!currentQrCode) {
      console.log('⚠️ No QR code set, skipping check');
      return;
    }
    
    try {
      console.log('🌐 Fetching status for QR:', currentQrCode);
      const response = await fetch('https://api2.onfire.so/rpc/check_qr_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_qr_code: currentQrCode })
      });

      const data = await response.json();
      console.log('📡 QR Status Response:', data);
      
      if (!data || !data.success) {
        console.error('❌ Invalid response from check_qr_status', data);
        return;
      }
      
      if (data.status === 'confirmed' && data.jwt_token) {
        console.log('✅ QR Code confirmed! JWT Token received');
        console.log('📺 Display ID:', data.display_id);
        stopPolling();
        
        // Check if display_id is present
        if (data.display_id) {
          handleDisplayLinked(data.jwt_token, data.display_id);
        } else {
          // Fallback: No display linked (regular login)
          handleQRSuccess(data.jwt_token);
        }
      } else if (data.status === 'expired') {
        console.log('⏰ QR Code expired');
        stopPolling();
        handleQRExpired();
      } else if (data.status === 'pending') {
        console.log('⏳ Still pending... (polling continues)');
        // Continue polling
      } else {
        console.log('❓ Unknown status:', data.status);
      }
    } catch (error) {
      console.error('❌ Status check error:', error);
      console.error('Error details:', error.message, error.stack);
    }
  };

  const handleQRSuccess = async (jwtToken) => {
    console.log('🎉 QR Login successful!');
    setQrStatus('success');
    setQrMessage('✅ Login successful! Redirecting...');
    
    try {
      // Fetch user data first
      const userResponse = await fetch('https://api2.onfire.so/users?select=id,email,username,first_name,last_name', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      let userData = null;
      if (userResponse.ok) {
        const users = await userResponse.json();
        if (users && users.length > 0) {
          userData = users[0];
          console.log('✅ User data fetched:', userData);
        }
      }
      
      // Store in localStorage
      localStorage.setItem('onfire_access_token', jwtToken);
      localStorage.setItem('onfire_refresh_token', jwtToken);
      if (userData) {
        localStorage.setItem('onfire_user_data', JSON.stringify(userData));
      }
      
      // IMPORTANT: Initialize onFireAPI instance variables
      // This is critical for isAuthenticated() to work
      onFireAPI.accessToken = jwtToken;
      onFireAPI.refreshToken = jwtToken;
      onFireAPI.userData = userData;
      
      console.log('✅ OnFireAPI instance initialized');
      console.log('✅ isAuthenticated:', onFireAPI.isAuthenticated());
      
      // Wait a bit for all state to settle, then navigate
      setTimeout(() => {
        console.log('🚀 Navigating to dashboard...');
        navigate('/dashboard');
      }, 500);
    } catch (error) {
      console.error('❌ Error in QR login success handler:', error);
      // Even on error, try to set basic auth
      localStorage.setItem('onfire_access_token', jwtToken);
      localStorage.setItem('onfire_refresh_token', jwtToken);
      onFireAPI.accessToken = jwtToken;
      onFireAPI.refreshToken = jwtToken;
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    }
  };

  const handleDisplayLinked = async (jwtToken, displayId) => {
    console.log('📺 Display linked! Display ID:', displayId);
    setQrStatus('success');
    setQrMessage('✅ Display linked! Redirecting...');
    
    try {
      // Fetch user data first
      const userResponse = await fetch('https://api2.onfire.so/users?select=id,email,username,first_name,last_name', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      let userData = null;
      if (userResponse.ok) {
        const users = await userResponse.json();
        if (users && users.length > 0) {
          userData = users[0];
          console.log('✅ User data fetched:', userData);
        }
      }
      
      // Store in localStorage (including display_id)
      localStorage.setItem('onfire_access_token', jwtToken);
      localStorage.setItem('onfire_refresh_token', jwtToken);
      localStorage.setItem('onfire_display_id', displayId);
      if (userData) {
        localStorage.setItem('onfire_user_data', JSON.stringify(userData));
      }
      
      // IMPORTANT: Initialize onFireAPI instance variables
      onFireAPI.accessToken = jwtToken;
      onFireAPI.refreshToken = jwtToken;
      onFireAPI.userData = userData;
      
      console.log('✅ OnFireAPI instance initialized with display');
      console.log('✅ isAuthenticated:', onFireAPI.isAuthenticated());
      console.log('📺 Display ID stored:', displayId);
      
      // Wait a bit for all state to settle, then navigate
      setTimeout(() => {
        console.log('🚀 Navigating to dashboard with display...');
        navigate('/dashboard');
      }, 500);
    } catch (error) {
      console.error('❌ Error in display linked handler:', error);
      // Even on error, try to set basic auth
      localStorage.setItem('onfire_access_token', jwtToken);
      localStorage.setItem('onfire_refresh_token', jwtToken);
      localStorage.setItem('onfire_display_id', displayId);
      onFireAPI.accessToken = jwtToken;
      onFireAPI.refreshToken = jwtToken;
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    }
  };

  const handleQRExpired = () => {
    setQrStatus('expired');
    setQrMessage('⏰ QR code expired. Click to refresh.');
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
    
    // Cleanup on unmount or tab switch
    return () => {
      if (activeTab !== 'qr') {
        stopPolling();
      }
    };
  }, [activeTab]);

  // Cleanup on component unmount (e.g., when navigating away)
  useEffect(() => {
    return () => {
      console.log('🧹 Login component unmounting, stopping all polling...');
      stopPolling();
    };
  }, []);

  return (
    <div className="login-container">
      <div className="login-content">
        <Card className="login-card">
          <CardHeader>
            <CardTitle className="login-title">Welcome Back</CardTitle>
            <CardDescription>Sign in to access your Task Management HUD</CardDescription>
          </CardHeader>
          <CardContent>
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
                  <Label htmlFor="email">Email</Label>
                  <Input
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
                  <Label htmlFor="password">Password</Label>
                  <Input
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
                  <div className="error-message">
                    {error}
                  </div>
                )}
                <Button type="submit" className="login-button" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;