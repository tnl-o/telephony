#!/bin/sh
# Браузеры в LAN должны слать RTP на IP хоста (проброшенные UDP 16384+), а не на 100.64.x из docker-сети.
if [ -n "$LAN_PUBLISH_IP" ]; then
  VARS=/etc/freeswitch/vars.xml
  if [ -f "$VARS" ]; then
    sed -i "s|data=\"external_rtp_ip=[^\"]*\"|data=\"external_rtp_ip=${LAN_PUBLISH_IP}\"|g" "$VARS"
    sed -i "s|data=\"external_sip_ip=[^\"]*\"|data=\"external_sip_ip=${LAN_PUBLISH_IP}\"|g" "$VARS"
    echo "[docker-entrypoint] LAN_PUBLISH_IP=${LAN_PUBLISH_IP} -> external_rtp_ip / external_sip_ip"
  fi
fi
exec /docker-entrypoint-vanilla.sh
