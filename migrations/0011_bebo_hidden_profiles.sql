-- Add hidden field to bebo profiles
ALTER TABLE bebo_profiles ADD COLUMN hidden INTEGER DEFAULT 1;

-- Make profiles visible if they have any content set
UPDATE bebo_profiles
SET hidden = 0
WHERE bio IS NOT NULL
   OR profile_pic_key IS NOT NULL
   OR cover_photo_key IS NOT NULL;
