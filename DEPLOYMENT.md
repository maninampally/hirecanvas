# HireCanvas — Production Deployment Guide

Deploy HireCanvas to an AWS EC2 instance with Docker, Nginx, and Let's Encrypt SSL.

---

## Prerequisites

- AWS account with EC2 access
- Domain name with DNS pointing to your server
- SSH key pair for EC2 access
- GitHub repository with the code
- Supabase project created with all 24 migrations executed

---

## 1. EC2 Instance Setup

```bash
# Launch Ubuntu 24.04 LTS instance
# Recommended: t3.medium (2 vCPU, 4GB RAM)
# Storage: 30GB gp3
# Security Group: Allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS)

# SSH into instance
ssh -i your-key.pem ubuntu@<your-instance-ip>

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker & Docker Compose
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker ubuntu
newgrp docker

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

---

## 2. Clone & Configure

```bash
cd /opt
sudo mkdir -p hirecanvas && sudo chown ubuntu:ubuntu hirecanvas
git clone https://github.com/<your-username>/hirecanvas.git /opt/hirecanvas
cd /opt/hirecanvas

# Create production env file
cp .env.example .env.production
nano .env.production
# Fill in ALL production secrets:
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
#   REDIS_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
#   GEMINI_API_KEY, ANTHROPIC_API_KEY (when ready)
#   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (when ready)
#   TOKEN_ENCRYPTION_KEY
#   NEXT_PUBLIC_APP_URL=https://<your-domain>
```

---

## 3. Nginx Configuration

```bash
# Copy config — update server_name in the file to match your domain
sudo cp nginx/hirecanvas.conf /etc/nginx/sites-available/hirecanvas
sudo nano /etc/nginx/sites-available/hirecanvas
# Change: server_name your-domain.com www.your-domain.com;

# Enable site & remove default
sudo ln -s /etc/nginx/sites-available/hirecanvas /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test & restart
sudo nginx -t && sudo systemctl restart nginx
```

---

## 4. SSL Certificate (Let's Encrypt)

```bash
sudo certbot certonly --nginx \
  -d <your-domain> -d www.<your-domain> \
  --non-interactive --agree-tos \
  --email <your-email>

# Update Nginx config SSL paths if needed, then restart
sudo nginx -t && sudo systemctl restart nginx
```

---

## 5. Build & Deploy with Docker Compose

```bash
# Create production override
cat > docker-compose.prod.yml << 'EOF'
services:
  app:
    environment:
      - NODE_ENV=production
      - DOCKER_BUILDKIT=1
    restart: unless-stopped

  redis:
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  redis_data:
    driver: local
EOF

# Build and start
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Verify containers are running
docker compose ps

# Check logs (Ctrl+C to exit)
docker compose logs -f --tail=100 app
```

---

## 6. CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to EC2

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to EC2
        uses: appleboy/ssh-action@v0.1.10
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_KEY }}
          script: |
            cd /opt/hirecanvas
            git pull origin main
            docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
            echo "Deploy complete"
```

**Required GitHub Secrets:**
- `EC2_HOST` — your EC2 public IP or domain
- `EC2_KEY` — your SSH private key

---

## 7. Monitoring & Health Checks

```bash
# Health check endpoint
curl https://<your-domain>/api/health
# Expected: 200 OK with JSON status

# Optional: CloudWatch agent for CPU/memory alerts
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
```

---

## 8. Database Backups

Supabase handles automated backups:
- Set backup frequency to **Daily** in your Supabase dashboard
- Enable point-in-time recovery (30 days) on paid plans

---

## 9. SSL Auto-Renewal

Certbot sets up a cron/systemd timer automatically. Verify with:

```bash
sudo certbot renew --dry-run
```

---

## 10. Troubleshooting

```bash
# Check Docker containers
docker compose ps
docker compose logs --tail=50 app

# Check Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log

# Check SSL certificate
sudo certbot certificates

# Restart everything
docker compose restart
sudo systemctl restart nginx
```

---

## Scaling (Future)

When traffic grows:
- Single EC2 → ALB + multiple instances
- Redis on EC2 → AWS ElastiCache
- File storage → S3 for resumes
- Supabase → dedicated plan
- Static assets → CloudFront CDN

---

## Monitoring Checklist

- [ ] SSL certificate auto-renewal verified
- [ ] CloudWatch CPU/memory alerts configured
- [ ] Disk space monitoring enabled
- [ ] Health check endpoint returning 200
- [ ] Database backups confirmed in Supabase
- [ ] Redis memory usage monitored
