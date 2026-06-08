DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.services
    WHERE lower(title) = lower('AUTONOMOUS BOT')
  ) THEN
    UPDATE public.services
    SET
      title = 'AUTONOMOUS BOT',
      description = $json$
{
  "description": "Upload product photos, add a caption to each one, preview the queue in real time, and prepare a human-approved publishing workflow for your content calendar.",
  "subtitle": "AUTONOMOUS BOT",
  "button_text": "BUILD QUEUE",
  "min_quantity": 1,
  "free_trial_amount": 0,
  "custom_fields": []
}
$json$,
      starting_price = 499,
      icon_type = 'automation'
    WHERE lower(title) = lower('AUTONOMOUS BOT');
  ELSE
    INSERT INTO public.services (
      title,
      description,
      starting_price,
      icon_type
    ) VALUES (
      'AUTONOMOUS BOT',
      $json$
{
  "description": "Upload product photos, add a caption to each one, preview the queue in real time, and prepare a human-approved publishing workflow for your content calendar.",
  "subtitle": "AUTONOMOUS BOT",
  "button_text": "BUILD QUEUE",
  "min_quantity": 1,
  "free_trial_amount": 0,
  "custom_fields": []
}
$json$,
      499,
      'automation'
    );
  END IF;
END $$;
