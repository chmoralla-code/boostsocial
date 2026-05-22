async function main() {
  try {
    const res = await fetch("https://rixeysmm.shop/services");
    if (!res.ok) {
      console.error("Failed to fetch public services page:", res.status);
      return;
    }
    const html = await res.text();
    console.log("HTML length:", html.length);
    
    const averageTimes = {};
    
    // Test regex 1: data-service-id
    const regex = /data-service-id="(\d+)"[\s\S]*?<td class="avarage_time_Services">([\s\S]*?)<\/td>/g;
    let match;
    let count1 = 0;
    while ((match = regex.exec(html)) !== null) {
      const serviceId = match[1];
      const avgTime = match[2].trim();
      averageTimes[serviceId] = avgTime;
      count1++;
    }
    console.log("Regex 1 matches count:", count1);
    
    // Test regex 2: order_id
    const fallbackRegex = /<span id="servis_id" class="order_id">(\d+)<\/span>[\s\S]*?<td class="avarage_time_Services">([\s\S]*?)<\/td>/g;
    let count2 = 0;
    while ((match = fallbackRegex.exec(html)) !== null) {
      const serviceId = match[1];
      const avgTime = match[2].trim();
      averageTimes[serviceId] = avgTime;
      count2++;
    }
    console.log("Regex 2 matches count:", count2);
    
    // Let's inspect some of the results
    console.log("\nParsed average times (sample of 15):");
    const keys = Object.keys(averageTimes);
    console.log("Total unique services parsed:", keys.length);
    keys.slice(0, 20).forEach(id => {
      console.log(`- Service ID: ${id} | Avg Time: "${averageTimes[id]}"`);
    });
    
    // Check our core service IDs specifically:
    console.log("\nSpecific mappings check:");
    console.log("Service 2983 (FB Followers):", averageTimes["2983"]);
    console.log("Service 2984 (FB Followers with refill):", averageTimes["2984"]);
    console.log("Service 2858 (FB Likes/Reactions):", averageTimes["2858"]);
    console.log("Service 962 (FB Views):", averageTimes["962"]);
  } catch (err) {
    console.error(err);
  }
}

main();
