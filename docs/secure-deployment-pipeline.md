# Secure Deployment Pipeline Guide

## Overview

This guide outlines a secure CI/CD pipeline for deploying Dots 3D to Cloudflare Workers while maintaining security best practices and preventing exposure of sensitive credentials.

## Security Principles

1. **Zero Trust**: No secrets in code or configuration files
2. **Least Privilege**: Minimal permissions for deployment tokens
3. **Environment Isolation**: Separate credentials for dev/staging/production
4. **Audit Trail**: All deployments are logged and traceable
5. **Rollback Ready**: Quick rollback capability for failed deployments

## Secrets Management Strategy

### GitHub Repository Secrets

#### Required Secrets
1. **`CLOUDFLARE_ACCOUNT_ID`**
   - Purpose: Identifies your Cloudflare account
   - Sensitivity: Medium (not highly sensitive but should be private)
   - Source: Cloudflare Dashboard → Account ID (right sidebar)

2. **`CLOUDFLARE_API_TOKEN`**
   - Purpose: Authenticates deployments to Cloudflare
   - Sensitivity: HIGH (full deployment access)
   - Permissions: `Account:Cloudflare Workers:Edit`
   - Source: Cloudflare Dashboard → My Profile → API Tokens

#### Optional Secrets (for enhanced security)
1. **`SLACK_WEBHOOK_URL`**
   - Purpose: Deployment notifications
   - Use: Alert team of successful/failed deployments

2. **`SENTRY_AUTH_TOKEN`**
   - Purpose: Error tracking integration
   - Use: Upload source maps securely

### Token Security Best Practices

#### API Token Configuration
```yaml
# Recommended API Token Permissions
Account:
  - Cloudflare Workers:Edit
  - Account Settings:Read

Zone:
  - Zone Settings:Read
  - Zone:Read

# Restrict by IP (if using fixed runners)
IP Address Filtering: GitHub Actions IP ranges (optional)

# Expiration
TTL: 1 year maximum, rotate annually
```

#### Token Rotation Strategy
1. **Annual Rotation**: Rotate tokens yearly
2. **Compromise Response**: Immediate rotation if suspected breach
3. **Access Review**: Quarterly review of token permissions
4. **Multiple Tokens**: Separate tokens for different environments (optional)

## Environment-Based Security

### Development Environment
```yaml
Environment: development
Secrets Exposure: Limited
Access Control: All team members
Deployment Trigger: Any branch
Security Level: Relaxed
```

### Preview Environment
```yaml
Environment: preview
Secrets Exposure: Limited
Access Control: PR reviewers
Deployment Trigger: Pull requests
Security Level: Moderate
```

### Production Environment
```yaml
Environment: production
Secrets Exposure: Minimal
Access Control: Maintainers only
Deployment Trigger: Main branch only
Security Level: Strict
```

## Secure GitHub Actions Configuration

### Branch Protection Rules
```yaml
Branch: main
Required Status Checks:
  - tests-pass
  - typecheck-pass
  - security-scan
Require PR Reviews: true
Dismiss Stale Reviews: true
Require Code Owner Reviews: true
Restrict Push Access: maintainers only
```

### Enhanced CI/CD Pipeline
```yaml
# .github/workflows/secure-deploy.yml
name: Secure Deploy to Cloudflare

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  security-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Dependency vulnerability scan
      - name: Run npm audit
        run: npm audit --audit-level=high

      # License compliance check
      - name: License check
        run: npx license-checker --production --failOn="GPL;AGPL"

      # Secret scanning (additional layer)
      - name: GitLeaks scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  tests:
    runs-on: ubuntu-latest
    needs: security-checks
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci  # Use ci for deterministic installs

      - name: Run tests
        run: npm test
        env:
          CI: true

      - name: TypeScript check
        run: npx tsc --noEmit

  deploy-preview:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    needs: [security-checks, tests]
    environment: preview  # GitHub environment protection
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          NODE_ENV: production

      - name: Deploy to Cloudflare (Preview)
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env preview
          wranglerVersion: '3'

      - name: Security headers check
        run: |
          sleep 10  # Wait for deployment
          curl -I https://dots-3d-preview.yourdomain.workers.dev | grep -E "(X-|Content-Security-Policy|Strict-Transport-Security)"

  deploy-production:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: [security-checks, tests]
    environment: production  # Requires manual approval
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          NODE_ENV: production

      - name: Deploy to Cloudflare (Production)
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
          wranglerVersion: '3'

      - name: Post-deployment verification
        run: |
          sleep 15  # Wait for global propagation
          curl -f https://dots-3d.com/health || exit 1

      - name: Notify team (optional)
        if: success()
        run: |
          curl -X POST -H 'Content-type: application/json' \
            --data '{"text":"✅ Dots 3D deployed to production successfully"}' \
            ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Environment Protection Rules

#### GitHub Environment Configuration
```yaml
# Settings → Environments → production
Environment: production
Protection Rules:
  - Required reviewers: 2 maintainers
  - Wait timer: 5 minutes
  - Deployment branches: main only

Environment: preview
Protection Rules:
  - Required reviewers: 1 reviewer
  - Wait timer: 0 minutes
  - Deployment branches: all branches
```

## Runtime Security

### Worker Security Headers
```typescript
// Add to worker response headers
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' wss:;",
  'Strict-Transport-Security': 'max-age=86400; includeSubDomains'
};
```

### Durable Objects Security
```typescript
class GameRoom {
  // Rate limiting
  private requestCounts = new Map<string, number>();

  // Input validation
  private validateMove(move: any): boolean {
    return typeof move.start === 'object' &&
           typeof move.end === 'object' &&
           this.isValidCoordinate(move.start) &&
           this.isValidCoordinate(move.end);
  }

  // Access control
  private isAuthorizedPlayer(websocket: WebSocket, playerId: string): boolean {
    return this.players.some(p => p.websocket === websocket && p.id === playerId);
  }
}
```

## Monitoring & Alerting

### Deployment Monitoring
```yaml
# Cloudflare Analytics
Metrics to Monitor:
  - Request success rate (> 99.5%)
  - Response time (< 200ms p95)
  - Error rate (< 0.5%)
  - Durable Objects creation rate
  - WebSocket connection count

Alerts:
  - Error rate spike (> 2%)
  - High latency (> 500ms p95)
  - Deployment failures
  - Unusual traffic patterns
```

### Security Monitoring
1. **Failed authentication attempts**
2. **Unusual request patterns**
3. **High error rates from specific IPs**
4. **WebSocket connection anomalies**

## Incident Response

### Deployment Rollback
```bash
# Emergency rollback procedure
wrangler rollback --env production

# Or deploy previous known-good version
git revert <commit-hash>
git push origin main  # Triggers automatic redeployment
```

### Security Incident Response
1. **Immediate**: Rotate API tokens
2. **Assessment**: Review logs and metrics
3. **Communication**: Notify team via Slack
4. **Recovery**: Deploy fixes and verify
5. **Post-mortem**: Document lessons learned

## Compliance & Auditing

### Audit Trail
All deployments are tracked via:
1. **GitHub Actions logs** (retained for 90 days)
2. **Cloudflare audit logs** (Enterprise feature)
3. **Git commit history** (permanent)
4. **Slack notifications** (searchable history)

### Compliance Checklist
- [ ] No hardcoded secrets in repository
- [ ] All API tokens have minimal required permissions
- [ ] Production deployments require manual approval
- [ ] All changes go through peer review
- [ ] Security scanning in CI pipeline
- [ ] Dependency vulnerability monitoring
- [ ] Regular token rotation schedule
- [ ] Incident response plan documented
- [ ] Backup and rollback procedures tested

## Best Practices Summary

### Do's ✅
- Use GitHub repository secrets for all sensitive data
- Implement environment-specific protection rules
- Require peer review for production deployments
- Monitor deployment success rates and security metrics
- Rotate API tokens regularly
- Use least-privilege permissions for tokens
- Test rollback procedures regularly
- Document all security procedures

### Don'ts ❌
- Never commit secrets to version control
- Don't use personal API tokens for CI/CD
- Don't skip security scans in rush deployments
- Don't grant excessive permissions to deployment tokens
- Don't deploy directly to production without testing
- Don't ignore security alerts or monitoring
- Don't use the same credentials across environments

This secure deployment pipeline ensures your Dots 3D game can be deployed safely to Cloudflare while maintaining security best practices and enabling rapid, reliable deployments.