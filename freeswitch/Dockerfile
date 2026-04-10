FROM freeswitch/freeswitch:stable

LABEL maintainer="Telephony Project"
LABEL description="FreeSWITCH with WebRTC (WSS) and Opus codec support"

# Install additional packages
RUN apt-get update && apt-get install -y \
    openssl \
    libopus0 \
    libopus-dev \
    && rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p /etc/freeswitch/tls \
    && mkdir -p /var/log/freeswitch \
    && mkdir -p /var/lib/freeswitch/storage

# Copy configuration files
COPY conf/ /etc/freeswitch/conf/

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose ports
# SIP Internal: 5060 (UDP/TCP), 7443 (WSS)
# SIP External: 5061 (UDP/TCP)
# RTP: 16384-32768
# Event Socket: 8021
EXPOSE 5060/udp 5060/tcp 5061/udp 5061/tcp
EXPOSE 7443/tcp
EXPOSE 16384-32768/udp
EXPOSE 8021/tcp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD fs_cli -x "status" || exit 1

# Start FreeSWITCH
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
