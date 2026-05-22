const apiKey = '8527e5fc153203f0884d44e9afc3be17';
const url = 'https://rixeysmm.shop/api/v2';

async function main() {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        key: apiKey,
        action: 'services',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const services = await response.json();
    console.log(`Fetched ${services.length} services from RixeySMM.`);
    
    // Print first 5 services to inspect format
    console.log('Sample Services:', services.slice(0, 5));

    // Filter and print some cheap FB followers, reactions, and views
    const followers = services.filter(s => {
      const name = s.name.toLowerCase();
      const cat = s.category.toLowerCase();
      return (name.includes('follower') || cat.includes('follower')) && 
             (name.includes('facebook') || cat.includes('facebook') || name.includes('fb') || cat.includes('fb')) &&
             !name.includes('instagram') && !name.includes('tiktok') && !name.includes('twitter');
    });

    console.log(`Found ${followers.length} FB Followers services.`);
    console.log('Followers sample:', followers.slice(0, 3));

    const reactions = services.filter(s => {
      const name = s.name.toLowerCase();
      const cat = s.category.toLowerCase();
      return (name.includes('reaction') || name.includes('like') || cat.includes('reaction') || cat.includes('like')) && 
             (name.includes('facebook') || cat.includes('facebook') || name.includes('fb') || cat.includes('fb')) &&
             !name.includes('instagram') && !name.includes('tiktok') && !name.includes('twitter');
    });

    console.log(`Found ${reactions.length} FB Reactions services.`);
    console.log('Reactions sample:', reactions.slice(0, 3));

  } catch (err) {
    console.error('Error fetching RixeySMM services:', err);
  }
}

main();
