-- CreateTable
CREATE TABLE "org_unit_canvas_layouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "positions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_unit_canvas_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_unit_canvas_layouts_org_id_user_id_key" ON "org_unit_canvas_layouts"("org_id", "user_id");

-- AddForeignKey
ALTER TABLE "org_unit_canvas_layouts" ADD CONSTRAINT "org_unit_canvas_layouts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_unit_canvas_layouts" ADD CONSTRAINT "org_unit_canvas_layouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
