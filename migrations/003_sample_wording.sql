UPDATE packages
SET policies = REPLACE(policies, 'Demonstration policy:', 'Sample policy:'),
    notes = REPLACE(notes, 'Fictional demonstration package.', 'Sample package.')
WHERE demo = true;

UPDATE website_content
SET body = REPLACE(REPLACE(REPLACE(body,
    'fictional demonstration packages', 'sample packages'),
    'demonstration', 'sample'), 'Demonstration', 'Sample')
WHERE `key` IN ('about', 'privacy', 'terms', 'cancellation', 'faq');
