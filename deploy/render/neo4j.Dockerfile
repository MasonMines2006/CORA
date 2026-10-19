FROM neo4j:5.23

COPY deploy/render/neo4j-start.sh /usr/local/bin/cora-neo4j-start
RUN chmod 0755 /usr/local/bin/cora-neo4j-start

ENTRYPOINT ["/usr/local/bin/cora-neo4j-start"]
