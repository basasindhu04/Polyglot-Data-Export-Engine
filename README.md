# High-Performance Data Export Engine

A robust, containerized Node.js application for streaming large datasets (10M+ rows) in CSV, JSON, XML, and Parquet formats with low memory footprint.

## Features

-   **Streaming Architecture**: Uses Node.js streams and `pg-query-stream` to process data row-by-row, ensuring constant memory usage (< 256MB).
-   **Multiple Formats**: 
    -   CSV (with flattened JSON)
    -   JSON (Array of objects)
    -   XML (Custom schema)
    -   Parquet (Columnar storage)
-   **Compression**: Optional Gzip compression for text formats.
-   **Benchmarks**: Built-in endpoint to measure performance.
-   **Containerized**: Docker and Docker Compose ready.
-   **Automated Seeding**: Generates 10 million records on startup.

## Setup & Running

### Prerequisites
-   Docker & Docker Compose

### Quick Start

1.  Clone the repository.
2.  Run the application:
    ```bash
    docker-compose up --build
    ```
3.  Wait for the database execution to finish seeding (approx. 1-2 mins for 10M rows). Check the logs for `Database already seeded` or seeding progress.

The API will be available at `http://localhost:8080`.

## API Documentation

### 1. Create Export Job

**POST** `/exports`

Creates a new export job.

**Body:**
```json
{
  "format": "csv", // or "json", "xml", "parquet"
  "columns": [
    { "source": "id", "target": "ID" },
    { "source": "name", "target": "FullName" },
    { "source": "metadata", "target": "Meta" }
  ],
  "compression": "gzip" // optional, not for parquet
}
```

**Response:**
```json
{
  "exportId": "uuid-string",
  "status": "pending"
}
```

### 2. Download Export

**GET** `/exports/{exportId}/download`

Streams the generated file.

### 3. Run Benchmark

**GET** `/exports/benchmark`

Runs a performance test for all formats on the full dataset.

## Architecture

-   **Runtime**: Node.js (TypeScript)
-   **Database**: PostgreSQL 13
-   **Streaming**:
    -   `pg-query-stream`: Reads from DB cursor.
    -   `fast-csv`: CSV serialization.
    -   `xmlbuilder2` / Custom Transformer: XML serialization.
    -   `parquetjs-lite`: Parquet serialization.
-   **Memory Management**: All data flow is piped through streams. Backpressure is handled automatically by Node.js pipelines, preventing memory spikes.

## Configuration

Environment variables can be set in `.env` (passed via docker-compose):
-   `PORT`: API Port (default 8080)
-   `DATABASE_URL`: Postgres connection string.

## Development

Install dependencies:
```bash
npm install
```

Run in dev mode:
```bash
npm run dev
```

Build:
```bash
npm run build
```
