#!/bin/sh
PH=$(printf '%s' "${PUBLIC_HOST:-}" | tr -d '\r')
if [ -n "$PH" ]; then
  echo "[init-public-host] PUBLIC_HOST=$PH"
  sed -i "s/\(data=\"external_rtp_ip=\)[^\"]*/\1${PH}/" /etc/freeswitch/vars.xml
  sed -i "s/\(data=\"external_sip_ip=\)[^\"]*/\1${PH}/" /etc/freeswitch/vars.xml
fi

# Dev network: FreeSWITCH is at 100.64.0.10, directory uses this domain
# Override production default (100.64.1.10) so directory lookup matches
echo "[init-public-host] Forcing domain=100.64.0.10 for dev"
sed -i 's/\(data="domain=\)[^"]*/\1100.64.0.10/' /etc/freeswitch/vars.xml
sed -i 's/\(data="domain_name=\)[^"]*/\1100.64.0.10/' /etc/freeswitch/vars.xml

exec /docker-entrypoint.sh
