#!/bin/bash
set -e

# Run this script on the DigitalOcean Droplet after cloning the repo.
# Usage: bash deploy.sh

echo "=== Installing dependencies ==="
apt-get update -q
apt-get install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git

systemctl enable docker
systemctl start docker

echo "=== Cloning / updating repo ==="
REPO_DIR="/opt/psydict"
if [ -d "$REPO_DIR" ]; then
    cd "$REPO_DIR" && git pull
else
    git clone https://github.com/dtalero78/Psychology-Dictionary.git "$REPO_DIR"
    cd "$REPO_DIR"
fi

echo "=== Configuring Nginx ==="
cp backend/nginx.conf /etc/nginx/sites-available/psydict
ln -sf /etc/nginx/sites-available/psydict /etc/nginx/sites-enabled/psydict
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== Obtaining SSL certificate ==="
certbot --nginx -d api.psychologydictionary.app --non-interactive --agree-tos -m d_talero@yahoo.com

echo "=== Starting backend ==="
cd "$REPO_DIR/backend"
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "=== Running database migrations ==="
sleep 5
docker compose -f docker-compose.prod.yml exec api alembic upgrade head

echo "=== Done! Backend running at https://api.psychologydictionary.app ==="
