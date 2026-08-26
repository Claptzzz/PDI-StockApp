-- AlterTable
ALTER TABLE "User" ADD COLUMN     "roles" "Role"[] DEFAULT ARRAY[]::"Role"[];


-- Backfill: los usuarios existentes quedarian con `roles` vacio y perderian todo
-- acceso (la autorizacion pasa a evaluarse sobre el array). Se siembra con su rol
-- actual. Idempotente: solo toca filas sin roles.
UPDATE "User" SET "roles" = ARRAY["role"]::"Role"[] WHERE cardinality("roles") = 0;
