#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE TABLE IF NOT EXISTS records (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        name VARCHAR(255) NOT NULL,
        value DECIMAL(18, 4) NOT NULL,
        metadata JSONB NOT NULL
    );

    -- Create a simplified procedure to seed data in batches
    DO \$\$
    DECLARE
        SYSTEM_ROWS BIGINT := 10000000;
        BATCH_SIZE INT := 100000;
        CURRENT_COUNT BIGINT;
    BEGIN
        SELECT COUNT(*) INTO CURRENT_COUNT FROM records;
        
        IF CURRENT_COUNT < SYSTEM_ROWS THEN
            RAISE NOTICE 'Seeding database with % rows...', (SYSTEM_ROWS - CURRENT_COUNT);
            
            FOR i IN 0..((SYSTEM_ROWS - CURRENT_COUNT - 1) / BATCH_SIZE) LOOP
                INSERT INTO records (created_at, name, value, metadata)
                SELECT
                    NOW() - (random() * interval '365 days'),
                    'Record ' || (i * BATCH_SIZE + s.a),
                    (random() * 10000)::DECIMAL(18, 4),
                    jsonb_build_object(
                        'nested', jsonb_build_object('key', 'value_' || (i * BATCH_SIZE + s.a), 'number', (i * BATCH_SIZE + s.a)),
                        'tags', jsonb_build_array('tag1', 'tag2', 'tag3')
                    )
                FROM generate_series(1, BATCH_SIZE) AS s(a)
                LIMIT (SYSTEM_ROWS - CURRENT_COUNT - (i * BATCH_SIZE));
                
                -- Commit every batch to avoid huge transaction logs (implicitly handled in DO blocks if needed, but here we just loop)
                -- Note: DO blocks are single transaction. If this fails, we might need external loop. 
                -- But for 10M rows, a single transaction of 1GB WAL is usually ok on modern hardware. 
                -- If it fails, we can split into multiple psql calls.
                
            END LOOP;
        ELSE
            RAISE NOTICE 'Database already seeded.';
        END IF;
    END
    \$\$;
EOSQL
