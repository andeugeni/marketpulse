INSERT INTO tickers (symbol, name) VALUES
    ('RDDT', 'Reddit Inc.'),
    ('RKLB', 'Rocket Lab Corp.')
ON CONFLICT DO NOTHING;