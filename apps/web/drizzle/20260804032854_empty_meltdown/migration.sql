DROP INDEX "vaults_chain_protocol_vault_uidx";--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "network" varchar(7);--> statement-breakpoint
UPDATE "vaults" SET "network" = CASE WHEN "chain_id" = 11155111 THEN 'testnet' ELSE 'mainnet' END;--> statement-breakpoint
ALTER TABLE "vaults" ALTER COLUMN "network" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vaults" DROP COLUMN "chain_id";--> statement-breakpoint
ALTER TABLE "vaults" DROP COLUMN "protocol_address";--> statement-breakpoint
CREATE UNIQUE INDEX "vaults_network_vault_uidx" ON "vaults" ("network","vault_id");
