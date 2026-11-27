-- Accounts & Invoices direct messages become global (one thread per pair, same in every workspace).
UPDATE "chat_channels" SET "workspaceId" = NULL WHERE "type" = 'DIRECT';
