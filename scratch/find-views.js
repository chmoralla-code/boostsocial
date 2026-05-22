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

    const services = await response.json();
    
    const views = services.filter(s => {
      const name = s.name.toLowerCase();
      const cat = s.category.toLowerCase();
      return (name.includes('view') || name.includes('play') || cat.includes('view') || cat.includes('play')) && 
             (name.includes('facebook') || cat.includes('facebook') || name.includes('fb') || cat.includes('fb')) &&
             !name.includes('instagram') && !name.includes('tiktok') && !name.includes('twitter');
    });

    console.log(`Found ${views.length} FB Views services.`);
    // Sort by rate ascending
    views.sort((a, b) => Number(a.rate) - Number(b.rate));
    console.log('Cheapest FB Views:', views.slice(0, 5));
  } catch (e) {
    console.error(e);
  }
}

main();
