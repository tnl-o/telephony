#!/bin/sh
set -eu

# Use exactly the certificate already trusted for the website. In dev nginx
# generates it on first startup, so allow time for the shared bind mount.
attempt=0
while [ ! -s /etc/nginx_ssl/cert.pem ] || [ ! -s /etc/nginx_ssl/key.pem ]; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo '[docker-entrypoint] Missing shared TLS certificate/key; generate SSL certificates first.' >&2
    exit 1
  fi
  sleep 1
done
mkdir -p /etc/freeswitch/tls
cp /etc/nginx_ssl/cert.pem /etc/freeswitch/tls/wss.crt
cp /etc/nginx_ssl/key.pem /etc/freeswitch/tls/wss.key
cat /etc/nginx_ssl/cert.pem /etc/nginx_ssl/key.pem > /etc/freeswitch/tls/wss.pem
chmod 600 /etc/freeswitch/tls/wss.key
chmod 600 /etc/freeswitch/tls/wss.pem

SIP_DOMAIN=${FREESWITCH_SIP_DOMAIN:-100.64.1.10}
case "$SIP_DOMAIN" in
  ''|*[!a-zA-Z0-9.:-]*) echo 'Invalid FREESWITCH_SIP_DOMAIN' >&2; exit 1 ;;
esac
sed -i "s|data=\"domain=[^\"]*\"|data=\"domain=${SIP_DOMAIN}\"|g" /etc/freeswitch/vars.xml
sed -i "s|data=\"domain_name=[^\"]*\"|data=\"domain_name=${SIP_DOMAIN}\"|g" /etc/freeswitch/vars.xml

# Браузеры в LAN должны слать RTP на IP хоста (проброшенные UDP 16384+), а не на 100.64.x из docker-сети.
if [ -n "${LAN_PUBLISH_IP:-}" ]; then
  VARS=/etc/freeswitch/vars.xml
  if [ -f "$VARS" ]; then
    sed -i "s|data=\"external_rtp_ip=[^\"]*\"|data=\"external_rtp_ip=${LAN_PUBLISH_IP}\"|g" "$VARS"
    sed -i "s|data=\"external_sip_ip=[^\"]*\"|data=\"external_sip_ip=${LAN_PUBLISH_IP}\"|g" "$VARS"
    echo "[docker-entrypoint] LAN_PUBLISH_IP=${LAN_PUBLISH_IP} -> external_rtp_ip / external_sip_ip"
  fi
fi
exec /docker-entrypoint-vanilla.sh "$@"
