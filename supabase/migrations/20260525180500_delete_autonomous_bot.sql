-- Delete referencing orders first to satisfy foreign key constraints, then delete the service
DELETE FROM public.orders WHERE service_id = '0a3878c6-54ec-4f01-9f45-362643745cde';
DELETE FROM public.services WHERE id = '0a3878c6-54ec-4f01-9f45-362643745cde';
