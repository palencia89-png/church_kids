-- Migration: Add service_time column to attendance table

ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS service_time text DEFAULT '8:00 AM';
