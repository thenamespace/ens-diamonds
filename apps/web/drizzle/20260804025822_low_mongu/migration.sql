CREATE TABLE "vault_members" (
	"vault_record_id" uuid,
	"member_address" varchar(42),
	"position" integer NOT NULL,
	CONSTRAINT "vault_members_pk" PRIMARY KEY("vault_record_id","member_address")
);
--> statement-breakpoint
CREATE TABLE "vaults" (
	"id" uuid PRIMARY KEY,
	"chain_id" integer NOT NULL,
	"protocol_address" varchar(42) NOT NULL,
	"vault_id" varchar(66) NOT NULL,
	"creator_address" varchar(42) NOT NULL,
	"encrypted_data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "vault_members_member_address_idx" ON "vault_members" ("member_address");--> statement-breakpoint
CREATE UNIQUE INDEX "vaults_chain_protocol_vault_uidx" ON "vaults" ("chain_id","protocol_address","vault_id");--> statement-breakpoint
ALTER TABLE "vault_members" ADD CONSTRAINT "vault_members_vault_record_id_vaults_id_fkey" FOREIGN KEY ("vault_record_id") REFERENCES "vaults"("id") ON DELETE CASCADE;