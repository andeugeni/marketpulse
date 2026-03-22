INSERT INTO tickers (symbol, name) VALUES
    ('RDDT', 'Reddit Inc.'),
    ('RKLB', 'Rocket Lab Corp.'),
    ('GOOG', 'Alphabet Inc.'),
    ('SMCI', 'Supermmicro Computer Inc.')
ON CONFLICT DO NOTHING;