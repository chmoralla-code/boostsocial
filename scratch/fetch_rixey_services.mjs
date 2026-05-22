const apiKey = '8527e5fc153203f0884d44e9afc3be17';
const url = 'https://rixeysmm.shop/api/v2';

async function testFetch() {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      key: apiKey,
      action: 'services'
    })
  });
  
  if (res.ok) {
    const services = await res.json();
    console.log(`Fetched ${services.length} services from RixeySMM.`);
    // Print first 5 services to inspect format
    console.log('Sample Services:', JSON.stringify(services.slice(0, 5), null, 2));
    
    // Look for services matching "facebook follower", "facebook view", "facebook reaction"
    const fbFollowers = services.filter(s => s.name.toLowerCase().includes('follower') && s.name.toLowerCase().includes('facebook'));
    console.log(`\nFound ${fbFollowers.length} Facebook follower services.`);
    console.log('Followers Samples:', JSON.stringify(fbFollowers.slice(0, 3), null, 2));
    
    const fbViews = services.filter(s => s.name.toLowerCase().includes('view') && s.name.toLowerCase().includes('facebook'));
    console.log(`\nFound ${fbViews.length} Facebook view services.`);
    console.log('Views Samples:', JSON.stringify(fbViews.slice(0, 3), null, 2));
  } else {
    console.error('Failed to fetch:', res.status, await res.text());
  }
}

testFetch();
