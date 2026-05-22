const apiKey = process.env.RIXEYSMM_API_KEY;
if (!apiKey) {
  console.error("RIXEYSMM_API_KEY is missing!");
  process.exit(1);
}

const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";

async function main() {
  try {
    const res = await fetch(RIXEYSMM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        key: apiKey,
        action: "services",
      }),
    });

    const services = await res.json();
    console.log("Total SMM services fetched:", services.length);

    // Let's filter some Facebook candidates
    const fbServices = services.filter(s => {
      const name = (s.name || "").toLowerCase();
      const cat = (s.category || "").toLowerCase();
      return (name.includes("facebook") || cat.includes("facebook"));
    });

    console.log("\nSample FB SMM candidates properties:");
    fbServices.slice(0, 15).forEach(s => {
      console.log(`- ID: ${s.service} | Name: ${s.name} | Rate: ${s.rate}`);
      console.log(`  Keys:`, Object.keys(s));
      console.log(`  Details:`, JSON.stringify(s));
    });
  } catch (err) {
    console.error(err);
  }
}

main();
