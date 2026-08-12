CREATE TABLE "favourites" (
	"network" varchar(7),
	"address" varchar(42),
	"label" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favourites_pk" PRIMARY KEY("network","address","label")
);
--> statement-breakpoint
CREATE TABLE "vault_uris" (
	"vault_record_id" uuid PRIMARY KEY,
	"name" varchar(80) NOT NULL,
	"description" varchar(500) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "is_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "favourites_network_label_idx" ON "favourites" ("network","label");--> statement-breakpoint
ALTER TABLE "vault_uris" ADD CONSTRAINT "vault_uris_vault_record_id_vaults_id_fkey" FOREIGN KEY ("vault_record_id") REFERENCES "vaults"("id") ON DELETE CASCADE;