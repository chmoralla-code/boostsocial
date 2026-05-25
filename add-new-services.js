/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');

async function seedServices() {
  const supabaseUrl = 'https://bhunvginzhgnwjkprnxc.supabase.co';
  const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJodW52Z2luemhnbndqa3BybnhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA5NjYzMSwiZXhwIjoyMDk0NjcyNjMxfQ.7UBdq5wPsc5ViD9SeL7pPfYrEoE3rsXxU6jrykfDhco';
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // 1. EAP TP-Link Adaptation
  const eapDescription = JSON.stringify({
    description: "Premium EAP TP-Link Adaptation setup for optimized captive portal routing, security, and custom credentials control.",
    subtitle: "EAP TP-LINK ADAPTION",
    button_text: "ADD",
    min_quantity: 1,
    free_trial_amount: 0,
    custom_fields: [
      { id: "eap-mac-address", label: "EAP MAC Address", type: "text" },
      { id: "eap-username", label: "Username", type: "text" },
      { id: "eap-password", label: "Password", type: "text" }
    ]
  });

  // 2. Architectural Software
  const softwareDescription = JSON.stringify({
    description: "Get lifetime access to premium pre-activated architectural modeling, rendering, and productivity software tools.",
    subtitle: "ARCHITECTURAL SOFTWARE",
    button_text: "ADD",
    min_quantity: 1,
    free_trial_amount: 0,
    custom_fields: [
      { 
        id: "software-choice", 
        label: "Software Option", 
        type: "select", 
        options: ["D5 render", "Lumion", "Sketchup", "Autocad", "Revit", "Msword", "Enscape", "Other (Request of Choice)"] 
      },
      { 
        id: "custom-software", 
        label: "Request Software of Choice (Blank)", 
        type: "text" 
      },
      { 
        id: "fb-profile-link", 
        label: "Facebook Profile Link", 
        type: "text" 
      }
    ]
  });

  const autonomousDescription = JSON.stringify({
    description: "Upload product photos, add a caption to each one, preview the queue in real time, and prepare a human-approved publishing workflow for your content calendar.",
    subtitle: "AUTONOMOUS BOT",
    button_text: "BUILD QUEUE",
    min_quantity: 1,
    free_trial_amount: 0,
    custom_fields: []
  });

  console.log("Checking if EAP TP-Link Adaptation already exists...");
  const { data: existingEap } = await supabase.from('services').select('id').eq('title', 'EAP TPLINK ADAPTION');
  if (existingEap && existingEap.length > 0) {
    console.log("EAP service already exists, updating it...");
    await supabase.from('services').update({
      description: eapDescription,
      starting_price: 350,
      icon_type: 'pisowifi'
    }).eq('title', 'EAP TPLINK ADAPTION');
    console.log("✅ EAP service updated.");
  } else {
    console.log("Inserting EAP service...");
    const { data: newEap, error: err } = await supabase.from('services').insert({
      title: 'EAP TPLINK ADAPTION',
      description: eapDescription,
      starting_price: 350,
      icon_type: 'pisowifi'
    }).select().single();
    if (err) console.error("Error inserting EAP service:", err.message);
    else console.log("✅ EAP service created:", newEap.id);
  }

  console.log("Checking if Architectural Software already exists...");
  const { data: existingSoftware } = await supabase.from('services').select('id').eq('title', 'ARCHITECTURAL SOFTWARE');
  if (existingSoftware && existingSoftware.length > 0) {
    console.log("Architectural Software already exists, updating it...");
    await supabase.from('services').update({
      description: softwareDescription,
      starting_price: 250,
      icon_type: 'pisowifi'
    }).eq('title', 'ARCHITECTURAL SOFTWARE');
    console.log("✅ Architectural Software updated.");
  } else {
    console.log("Inserting Architectural Software...");
    const { data: newSw, error: err } = await supabase.from('services').insert({
      title: 'ARCHITECTURAL SOFTWARE',
      description: softwareDescription,
      starting_price: 250,
      icon_type: 'pisowifi'
    }).select().single();
    if (err) console.error("Error inserting Architectural Software:", err.message);
    else console.log("✅ Architectural Software created:", newSw.id);
  }

  console.log("Checking if Autonomous Bot already exists...");
  const { data: existingAutonomous } = await supabase.from('services').select('id').eq('title', 'AUTONOMOUS BOT');
  if (existingAutonomous && existingAutonomous.length > 0) {
    console.log("Autonomous Bot already exists, updating it...");
    await supabase.from('services').update({
      description: autonomousDescription,
      starting_price: 499,
      icon_type: 'automation'
    }).eq('title', 'AUTONOMOUS BOT');
    console.log("Autonomous Bot updated.");
  } else {
    console.log("Inserting Autonomous Bot...");
    const { data: newAutonomous, error: err } = await supabase.from('services').insert({
      title: 'AUTONOMOUS BOT',
      description: autonomousDescription,
      starting_price: 499,
      icon_type: 'automation'
    }).select().single();
    if (err) console.error("Error inserting Autonomous Bot:", err.message);
    else console.log("Autonomous Bot created:", newAutonomous.id);
  }
}

seedServices();
