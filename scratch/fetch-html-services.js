async function main() {
  try {
    const res = await fetch("https://rixeysmm.shop/services");
    if (!res.ok) {
      console.error("Failed to fetch public services page:", res.status);
      return;
    }
    const html = await res.text();
    const index = html.indexOf("2983");
    if (index !== -1) {
      console.log("\nHTML Snippet for 2983 (large):");
      console.log(html.substring(index, index + 3500));
    }
  } catch (err) {
    console.error(err);
  }
}

main();
