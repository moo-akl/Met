-- Migration: add hub_checkins.source column
--
-- Adds a 'source' column to hub_checkins to distinguish between
-- GPS/Bluetooth proximity check-ins ('proximity') and physically
-- verified visits where the guest scanned the venue QR code ('qr_verified').
--
-- All existing rows default to 'proximity' (conservative: retroactive
-- QR credit is not assumed for historical data).
--
-- This column is used to:
--   - Show all visitors on the venue owner guest list (proximity + qr_verified)
--   - Restrict leaderboard ranks, crown rewards, pioneer scores, and streak
--     credit to qr_verified rows only, preventing proximity detection from
--     inflating competitive metrics.

ALTER TABLE "hub_checkins" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'proximity';
