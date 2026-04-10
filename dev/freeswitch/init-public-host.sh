#!/bin/sh
PH=$(printf '%s' "${PUBLIC_HOST:-}" | tr -d '\r')
if [ -n "$PH" ]; then
  echo "[init-public-host] PUBLIC_HOST=$PH"
  sed -i "s/\(data=\"external_rtp_ip=\)[^\"]*/\1${PH}/" /etc/freeswitch/vars.xml
  sed -i "s/\(data=\"external_sip_ip=\)[^\"]*/\1${PH}/" /etc/freeswitch/vars.xml
fi
exec /docker-entrypoint.sh