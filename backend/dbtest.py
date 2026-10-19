import os
import time
from neo4j import GraphDatabase


def get_neo4j_configuration():
    """Read credentials at runtime so secrets are never stored in source control."""
    required = ("NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD")
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

    return {
        "name": "Neo4j environment configuration",
        "uri": os.environ["NEO4J_URI"],
        "user": os.environ["NEO4J_USERNAME"],
        "password": os.environ["NEO4J_PASSWORD"],
    }

# Function to create a Neo4j driver
def create_driver(uri, user, password):
    return GraphDatabase.driver(uri, auth=(user, password))

# Function to clear the database
def clear_database(driver):
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")

# Performance test function
def performance_test(driver, query, num_operations):
    with driver.session() as session:
        start_time = time.time()
        for i in range(num_operations):
            session.run(query, parameters={"id": i, "name": f"name_{i}"})
        end_time = time.time()
    return end_time - start_time

# Query to execute
query = "CREATE (n:Person {id: $id, name: $name})"

# Number of operations to perform
num_operations = 1000

def dbtest_main():
    # This utility deletes every node before measuring writes. Require an
    # explicit opt-in so it cannot be run against production by accident.
    if os.environ.get("ALLOW_DESTRUCTIVE_DBTEST", "").lower() != "true":
        raise RuntimeError("Set ALLOW_DESTRUCTIVE_DBTEST=true to run this destructive benchmark")

    results = []

    config = get_neo4j_configuration()
    print(f"Testing {config['name']}...")

    driver = create_driver(config['uri'], config['user'], config['password'])
    try:
        clear_database(driver)
        elapsed_time = performance_test(driver, query, num_operations)
        results.append((config['name'], elapsed_time))
    finally:
        driver.close()

    print(f"{config['name']} completed in {elapsed_time:.4f} seconds")

    print("\nPerformance Test Results:")
    for name, time_taken in results:
        print(f"{name}: {time_taken:.4f} seconds")

if __name__ == "__main__":
    dbtest_main()
