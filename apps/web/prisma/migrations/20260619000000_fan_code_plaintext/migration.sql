-- Store the plaintext fan code so creators can view/redistribute it from the
-- dashboard (in addition to the hashed lookup column).
ALTER TABLE "FanAccessCode" ADD COLUMN "code" TEXT;
