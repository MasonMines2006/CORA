#!/bin/sh
set -eu

: "${NEO4J_PASSWORD:?NEO4J_PASSWORD is required}"
cora_neo4j_password="${NEO4J_PASSWORD}"

# Neo4j treats every remaining NEO4J_* variable as a database setting. Remove
# our application-only variable after converting it to the image's auth format.
unset NEO4J_PASSWORD
export NEO4J_AUTH="neo4j/${cora_neo4j_password}"

exec /startup/docker-entrypoint.sh neo4j
