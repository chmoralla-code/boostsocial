const packageFields = [
  { id: "fullName", label: "Full Name" },
  { id: "contactNumber", label: "Contact Number (Philippine)", type: "tel" },
  { id: "address", label: "Full Address", type: "textarea" },
  { id: "wifiName", label: "WiFi Name (SSID)" },
  { id: "wifiPassword", label: "WiFi Password" },
  { id: "wifiRate", label: "JuanFi Data Rate Limit (Mbps)", type: "number" },
  { id: "blankNotes", label: "Notes / Preferred Installation Schedule", type: "textarea", required: false },
];

const packages = [
  {
    title: "PISOWIFI STARTER",
    subtitle: "Starter Package",
    price: 5800,
    originalPrice: 7500,
    duration: "1 Year License | 50 Meters",
    clients: "20-30 Clients",
    features: [
      "1 Year License",
      "Telegram Sales Monitoring",
      "Pause Time Feature",
      "Anti Lag",
      "Voucher Code Generation",
      "Own Local Server",
      "Customized Portal",
      "Perfect for 20-30 Clients",
    ],
  },
  {
    title: "PISOWIFI PROFESSIONAL",
    subtitle: "Professional Package",
    price: 8500,
    originalPrice: 10000,
    duration: "3 Years License | 100 Meters",
    clients: "40-60 Clients",
    features: [
      "3 Year License",
      "Telegram Sales Monitoring",
      "Pause Time Feature",
      "Anti Lag",
      "Voucher Code Generation",
      "Own Local Server",
      "Customized Portal",
      "Perfect for 40-60 Clients",
    ],
  },
  {
    title: "PISOWIFI ENTERPRISE",
    subtitle: "Enterprise Package",
    price: 11000,
    originalPrice: 15000,
    duration: "Lifetime License | 250 Meters",
    clients: "80-100 Clients",
    features: [
      "Lifetime License",
      "Telegram Sales Monitoring",
      "Pause Time Feature",
      "Voucher Code Generation",
      "Own Local Server",
      "Customized Portal",
      "Perfect for 80-100 Clients",
      "Advanced Anti Lag Feature",
    ],
  },
];

function buildDescription(pkg) {
  return JSON.stringify({
    description: [
      `${pkg.duration}. Sale price: PHP ${pkg.price.toLocaleString("en-PH")} (from PHP ${pkg.originalPrice.toLocaleString("en-PH")}).`,
      `Includes: ${pkg.features.join(", ")}.`,
      "Checkout follows the manual PisoWiFi transaction flow: scan the existing GCash QR, upload proof of payment, enter customer/shipping details, and submit WiFi configuration for admin review.",
      "Shipping fee is free nationwide for this package.",
    ].join("\n\n"),
    subtitle: pkg.subtitle,
    button_text: "Buy PisoWiFi Package",
    min_quantity: 1,
    free_trial_amount: 0,
    custom_caption: "Sale price per PisoWiFi package",
    custom_fields: packageFields,
    original_price: pkg.originalPrice,
    duration: pkg.duration,
    recommended_clients: pkg.clients,
    transaction_flow: "GCash QR payment + receipt upload + customer details + WiFi configuration + pending admin review",
  });
}

async function upsertPisoWifiPackages() {
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  for (const [index, pkg] of packages.entries()) {
    const legacyTitles = index === 0 ? [pkg.title, "PISOWIFI"] : [pkg.title];
    const { data: existing, error: findError } = await supabase
      .from("services")
      .select("id,title")
      .in("title", legacyTitles)
      .limit(1)
      .maybeSingle();

    if (findError) throw findError;

    const payload = {
      title: pkg.title,
      description: buildDescription(pkg),
      starting_price: pkg.price,
      icon_type: "pisowifi",
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("services")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
      console.log(`Updated ${pkg.title} (${existing.id})`);
    } else {
      const { data, error } = await supabase
        .from("services")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      console.log(`Created ${pkg.title} (${data.id})`);
    }
  }
}

upsertPisoWifiPackages().catch((error) => {
  console.error("PisoWiFi package seed failed:", error.message || error);
  process.exit(1);
});
