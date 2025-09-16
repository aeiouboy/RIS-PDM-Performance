# Railway Deployment Guide

## 🚀 Quick Deployment Status
✅ **Logging Fixed**: Container-friendly console logging working
✅ **Full-Stack Ready**: Backend serves React app + API
✅ **Build Process**: Automated frontend build + backend start
⚠️ **Environment Variables**: Need Azure DevOps credentials

## 🔧 Required Railway Environment Variables

### 1. Core Application Settings
```bash
NODE_ENV=production
PORT=3002
```

### 2. Azure DevOps Integration (Required)
```bash
AZURE_DEVOPS_ORG=your-organization-name
AZURE_DEVOPS_PROJECT=your-project-name
AZURE_DEVOPS_PAT=your-personal-access-token
```

### 3. Optional Performance Settings
```bash
# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Real-time Updates
REALTIME_POLLING_INTERVAL=30000
ENABLE_INCREMENTAL_UPDATES=true
MAX_WEBSOCKET_CLIENTS=100

# Cache (if using Redis)
REDIS_URL=your-redis-connection-string
```

## 📋 Railway Setup Steps

### Step 1: Set Environment Variables
In your Railway dashboard:
1. Go to your service → **Variables** tab
2. Add the environment variables listed above
3. **Critical**: Set your actual Azure DevOps credentials

### Step 2: Azure DevOps PAT Setup
1. Go to Azure DevOps → **User Settings** → **Personal Access Tokens**
2. Create new token with these permissions:
   - **Read & Write**: Work Items
   - **Read**: Project and Team
   - **Read**: Analytics
3. Copy the token and set as `AZURE_DEVOPS_PAT`

### Step 3: Deploy
Railway will automatically:
1. Install dependencies for both frontend and backend
2. Build React frontend to `/frontend/dist`
3. Start backend server on port 3002
4. Backend serves both React app and API endpoints

## 🌐 URL Structure After Deployment

```
https://your-app.railway.app/
├── /                     → React Dashboard (Home)
├── /dashboard            → Main Performance Dashboard
├── /individual/*         → Individual Performance Pages
├── /api/metrics/*        → Backend API Endpoints
├── /api/users/*          → User Management API
├── /webhooks/*           → Azure DevOps Webhooks
└── /health               → Health Check Endpoint
```

## 🔍 Troubleshooting

### Issue: "Azure DevOps configuration validation failed"
**Solution**: Set proper environment variables:
- `AZURE_DEVOPS_ORG`: Your organization name (from Azure DevOps URL)
- `AZURE_DEVOPS_PAT`: Personal Access Token with proper permissions
- `AZURE_DEVOPS_PROJECT`: Your project name

### Issue: Frontend not loading
**Solution**: Ensure `NODE_ENV=production` is set in Railway environment variables

### Issue: API endpoints returning 404
**Solution**: Check that API routes are properly prefixed with `/api/`

## 📊 Monitoring

### Health Check
```bash
curl https://your-app.railway.app/health
```

### Logs
Railway automatically captures all console logs from the application. Logs are structured JSON in production for easy parsing and monitoring.

## 🎯 Post-Deployment Checklist

- [ ] Environment variables configured
- [ ] Azure DevOps PAT working
- [ ] Frontend loads at root URL
- [ ] API endpoints respond at `/api/*`
- [ ] Health check returns 200
- [ ] Real-time features working
- [ ] Performance data loading

## 💡 Production Optimizations

### Automatic Optimizations Included:
✅ **Production builds**: Minified React bundle
✅ **Compression**: Gzip compression enabled
✅ **Security headers**: Helmet middleware
✅ **Rate limiting**: API protection
✅ **Error handling**: Graceful error responses
✅ **Logging**: Structured JSON logs for monitoring

### Optional Enhancements:
- **Redis**: Add Redis URL for improved caching
- **CDN**: Consider Railway's CDN for static assets
- **Monitoring**: Add error tracking service integration
- **Alerts**: Set up Railway deployment notifications

---

## 🚀 Ready to Deploy!

Your application is fully configured for Railway deployment. The main requirement is setting up your Azure DevOps credentials in the Railway environment variables.

Once the environment variables are configured, your dashboard will be live and fully functional!

---
*Last updated: 2025-09-16 - Environment variables configured*