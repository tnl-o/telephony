ARG LAN_PUBLISH_IP=192.168.0.18

FROM alpine:3.19 AS tls
ARG LAN_PUBLISH_IP
RUN apk add --no-cache openssl
RUN mkdir -p /out \
  && openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /out/wss_key.pem \
    -out /out/wss_cert.pem \
    -subj "/CN=${LAN_PUBLISH_IP}" \
    -addext "subjectAltName=DNS:freeswitch,IP:${LAN_PUBLISH_IP},IP:127.0.0.1"

FROM safarov/freeswitch:latest

# Положить vanilla-конфиг в образ, чтобы entrypoint не затирал его при старте
RUN mkdir -p /etc/freeswitch && cp -a /usr/share/freeswitch/conf/vanilla/. /etc/freeswitch/

COPY docker/vars-append.inc /tmp/vars-append.inc
RUN awk '/<\/include>/ && !i { while ((getline line < "/tmp/vars-append.inc") > 0) print line; close("/tmp/vars-append.inc"); i=1 } { print }' /etc/freeswitch/vars.xml > /tmp/vars.xml && mv /tmp/vars.xml /etc/freeswitch/vars.xml && rm -f /tmp/vars-append.inc

COPY docker/acl.conf.xml /etc/freeswitch/autoload_configs/acl.conf.xml
COPY docker/event_socket.conf.xml /etc/freeswitch/autoload_configs/event_socket.conf.xml
COPY docker/sofia.conf.xml /etc/freeswitch/autoload_configs/sofia.conf.xml

# Remove vanilla IPv6-only profiles so our dual-stack configs take effect
RUN rm -f /etc/freeswitch/sip_profiles/internal-ipv6.xml \
          /etc/freeswitch/sip_profiles/external-ipv6.xml \
          && rm -rf /etc/freeswitch/sip_profiles/internal-ipv6 \
                     /etc/freeswitch/sip_profiles/external-ipv6

COPY conf/sip_profiles/internal.xml /etc/freeswitch/sip_profiles/internal.xml
COPY conf/sip_profiles/external.xml /etc/freeswitch/sip_profiles/external.xml
RUN mkdir -p /etc/freeswitch/gateways
COPY conf/gateways/freepbx_trunk.xml /etc/freeswitch/gateways/freepbx_trunk.xml

# Раньше 99_* — наш dialplan грузился последним; для внутренних номеров важен предсказуемый приоритет.
COPY conf/dialplan/default.xml /etc/freeswitch/dialplan/default/00_telephony_internal.xml

# Directory: vanilla FreeSWITCH загружает directory/default/*.xml
# Volume будет смонтирован в /etc/freeswitch/directory/default, поэтому создаём структуру
RUN mkdir -p /etc/freeswitch/directory/default
COPY conf/directory/default.xml /etc/freeswitch/directory/default/default.xml

RUN mkdir -p /etc/freeswitch/tls
COPY --from=tls /out/wss_key.pem /etc/freeswitch/tls/wss_key.pem
COPY --from=tls /out/wss_cert.pem /etc/freeswitch/tls/wss_cert.pem
# FreeSWITCH WSS profile expects a combined .pem file (cert + key)
RUN cat /etc/freeswitch/tls/wss_cert.pem /etc/freeswitch/tls/wss_key.pem > /etc/freeswitch/tls/wss.pem
RUN chmod 600 /etc/freeswitch/tls/wss_key.pem /etc/freeswitch/tls/wss.pem && chmod 644 /etc/freeswitch/tls/wss_cert.pem

RUN mv /docker-entrypoint.sh /docker-entrypoint-vanilla.sh
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh /docker-entrypoint-vanilla.sh

EXPOSE 5060/udp 5060/tcp 5061/udp 5061/tcp 7443/tcp 8021/tcp 16384-32768/udp

ENTRYPOINT ["/docker-entrypoint.sh"]
