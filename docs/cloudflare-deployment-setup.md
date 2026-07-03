# Cloudflare Deployment Setup Guide

## Overview

This guide covers deploying your Dots 3D game to Cloudflare Workers with Durable Objects for multiplayer WebSocket functionality. The deployment uses Cloudflare's edge computing platform to provide global, low-latency multiplayer gaming.

## Architecture

**Current (Local):**
- Vite dev server (port 3000/3001) for client
- Express + Socket.io server (port 3002) for WebSocket multiplayer

**New (Cloudflare):**
- Cloudflare Workers for static asset serving and API routing
- Durable Objects for game room state management and WebSocket handling
- Global edge deployment with automatic scaling

## Prerequisites

1. **Cloudflare Account**: Free or paid account at [cloudflare.com](https://cloudflare.com)
2. **Domain**: Custom domain for production (dots-3d.com)
3. **Node.js**: Version 18 or higher
4. **Wrangler CLI**: Cloudflare's development toolkit

## Step 1: Cloudflare Account Setup

### 1.1 Create Cloudflare Account
1. Go to [cloudflare.com](https://cloudflare.com)
2. Click "Sign Up" and create your account
3. Verify your email address

### 1.2 Get Account Credentials
1. **Account ID**:
   - Go to Cloudflare Dashboard → Right sidebar → Account ID
   - Copy this value (needed for deployment)

2. **API Token**:
   - Go to "My Profile" (top right corner)
   - Click "API Tokens" tab
   - Click "Create Token"
   - Use "Custom token" template
   - **Permissions**:
     - `Account` - `Cloudflare Workers:Edit`
     - `Zone` - `Zone Settings:Read, Zone:Read` (if using custom domain)
   - **Account Resources**: Include your account
   - **Zone Resources**: Include your domain (if applicable)
   - Click "Continue to summary" → "Create Token"
   - **IMPORTANT**: Copy this token immediately and store securely

### 1.3 Enable Workers/Durable Objects
1. In Cloudflare Dashboard, go to "Workers & Pages"
2. Click "Create" → "Create Worker"
3. This activates Workers on your account
4. For Durable Objects: They're automatically available with Workers

## Step 2: Domain Configuration (Production)

### 2.1 Add Domain to Cloudflare
1. In Cloudflare Dashboard, click "Add Site"
2. Enter your domain (e.g., `dots-3d.com`)
3. Select plan (Free is sufficient to start)
4. Complete DNS configuration as instructed
5. Wait for DNS propagation (can take up to 24 hours)

### 2.2 Worker Route Configuration
1. Go to Workers & Pages → Your worker
2. Click "Settings" → "Triggers"
3. Add route: `dots-3d.com/*`
4. Set zone to your domain

## Step 3: Local Development Setup

### 3.1 Install Dependencies
```bash
# Install Cloudflare Wrangler CLI globally
npm install -g wrangler

# Install project dependencies (includes wrangler locally)
npm install
```

### 3.2 Authenticate Wrangler
```bash
# Login to Cloudflare account
wrangler login

# Verify authentication
wrangler whoami
```

### 3.3 Configure wrangler.toml
The `wrangler.toml` file is already created. Update the following values:

```toml
name = "dots-3d"  # Change to your preferred worker name
# account_id = "YOUR_ACCOUNT_ID"  # Uncomment and add your account ID
```

## Step 4: GitHub Repository Setup

### 4.1 Repository Secrets
In your GitHub repository, add these secrets (Settings → Secrets and variables → Actions):

1. **CLOUDFLARE_ACCOUNT_ID**
   - Value: Your Cloudflare Account ID from Step 1.2

2. **CLOUDFLARE_API_TOKEN**
   - Value: Your Cloudflare API Token from Step 1.2

### 4.2 Branch Protection (Optional)
1. Go to Settings → Branches
2. Add rule for `main` branch
3. Require status checks to pass (includes our deploy action)
4. Require pull request reviews

## Step 5: Deployment Process

### 5.1 Local Development
```bash
# Start local development with Cloudflare Workers
npm run dev:local

# This runs both:
# - Vite dev server (client)
# - Wrangler dev (worker simulation)
```

### 5.2 Manual Deployment
```bash
# Deploy to development environment
npm run deploy:dev

# Deploy to preview environment
npm run deploy:preview

# Deploy to production
npm run deploy:prod
```

### 5.3 Automatic Deployment (CI/CD)
- **Pull Requests**: Automatically deploy to preview environment
- **Main Branch**: Automatically deploy to production
- Preview URLs are commented on PRs automatically

## Step 6: Environment Configuration

### 6.1 Development Environment
- **URL**: `https://dots-3d-dev.YOUR_SUBDOMAIN.workers.dev`
- **Purpose**: Testing new features
- **Database**: Isolated Durable Objects state

### 6.2 Preview Environment
- **URL**: `https://dots-3d-preview.YOUR_SUBDOMAIN.workers.dev`
- **Purpose**: PR reviews and staging
- **Database**: Isolated Durable Objects state

### 6.3 Production Environment
- **URL**: `https://dots-3d.com` (with custom domain)
- **Fallback**: `https://dots-3d.YOUR_SUBDOMAIN.workers.dev`
- **Purpose**: Live game
- **Database**: Production Durable Objects state

## Step 7: Testing Deployment

### 7.1 Verify Worker Deployment
```bash
# Check deployment status
wrangler status

# View logs
wrangler tail
```

### 7.2 Test Multiplayer Functionality
1. Open deployed URL in two browser windows
2. Create game room in first window
3. Join game room from second window
4. Verify real-time synchronization

### 7.3 Monitor Performance
1. Cloudflare Dashboard → Workers & Pages → Your worker
2. Check "Metrics" tab for:
   - Request volume
   - Success rate
   - CPU usage
   - Durable Objects usage

## Step 8: Custom Domain Setup (Production)

### 8.1 Add Custom Domain
1. Workers & Pages → Your worker → "Settings" → "Custom Domains"
2. Click "Add custom domain"
3. Enter `dots-3d.com`
4. Follow verification steps
5. SSL certificate is automatically provisioned

### 8.2 Update DNS Records (if needed)
Ensure your domain's DNS points to Cloudflare:
- A record: `@` → `198.41.214.163`
- A record: `@` → `198.41.215.163`
- CNAME record: `www` → `dots-3d.com`

## Step 9: Security & Production Considerations

### 9.1 Environment Variables
```bash
# Set production environment variables
wrangler secret put GAME_SECRET_KEY
wrangler secret put ANALYTICS_TOKEN
```

### 9.2 Rate Limiting
The Durable Objects implementation includes built-in protection:
- Connection limits per room
- Move validation
- Automatic cleanup of abandoned games

### 9.3 Monitoring
1. Set up Cloudflare Analytics
2. Monitor Worker metrics in dashboard
3. Set up alerts for high error rates

## Step 10: Cost Optimization

### 10.1 Workers Pricing
- **Free Tier**: 100,000 requests/day
- **Paid Tier**: $5/month + $0.30/million requests

### 10.2 Durable Objects Pricing
- **Free Tier**: 1 million requests/month
- **WebSocket connections**: Use hibernation API to reduce costs
- **Storage**: $0.20/GiB/month

### 10.3 Optimization Tips
1. Implement WebSocket hibernation for idle connections
2. Clean up finished games promptly
3. Use request batching where possible
4. Monitor usage in Cloudflare Dashboard

## Troubleshooting

### Common Issues

**1. Deployment Fails**
```bash
# Check wrangler configuration
wrangler whoami
wrangler secret list

# Verify account permissions
wrangler kv:namespace list
```

**2. WebSocket Connection Fails**
- Check browser console for errors
- Verify Durable Objects are enabled
- Check Worker logs with `wrangler tail`

**3. High Latency**
- Verify global deployment with `wrangler status`
- Check if using closest edge location
- Monitor "Time to First Byte" metrics

**4. Authentication Issues**
```bash
# Re-authenticate
wrangler logout
wrangler login
```

### Getting Help
1. Cloudflare Community: [community.cloudflare.com](https://community.cloudflare.com)
2. Workers Discord: [discord.gg/cloudflaredev](https://discord.gg/cloudflaredev)
3. Cloudflare Support: Available on paid plans

## Migration Strategy

### Phase 1: Parallel Deployment (Recommended)
1. Deploy to Cloudflare Workers alongside existing server
2. Test thoroughly with preview environment
3. Gradually migrate users to new deployment

### Phase 2: DNS Cutover
1. Update DNS to point to Cloudflare Workers
2. Monitor for issues
3. Keep old server running as backup for 48 hours

### Phase 3: Cleanup
1. Decommission old server infrastructure
2. Remove server-related code and dependencies
3. Update documentation

## Development Workflow

### Local Development
```bash
# Start full local environment
npm run dev          # Vite client only (for UI work)
npm run dev:local    # Client + Worker (for full-stack work)
npm run server       # Legacy server (for comparison/migration)
```

### Testing
```bash
npm test             # Run all tests
npm run build        # Test build process
npx tsc --noEmit     # TypeScript check
```

### Deployment
```bash
git checkout -b feature/new-feature
# Make changes
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
# Create PR → automatic preview deployment
# Merge to main → automatic production deployment
```

This completes your Cloudflare deployment setup. The configuration provides a modern, scalable, and cost-effective hosting solution for your multiplayer 3D game.