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
    console.log(`Total services: ${services.length}`);
    
    // Let's find details on 1141 (the current service we used for Followers)
    const currentFollowersSvc = services.find(s => s.service === '1141');
    console.log('Current service 1141:', JSON.stringify(currentFollowersSvc, null, 2));

    // Analyze followers services
    const followers = services.filter(s => {
      const name = s.name.toLowerCase();
      const cat = s.category.toLowerCase();
      return (name.includes('follower') || cat.includes('follower')) && 
             (name.includes('facebook') || cat.includes('facebook') || name.includes('fb') || cat.includes('fb'));
    });
    
    console.log(`\nFollowers count: ${followers.length}`);
    const sortedFollowers = followers.sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
    console.log('Cheapest 5 Followers services:');
    sortedFollowers.slice(0, 5).forEach(s => {
      console.log(`ID: ${s.service} | Rate: ${s.rate} | Name: ${s.name} | Cat: ${s.category} | Desc: ${s.desc ? s.desc.slice(0, 100) : 'none'}`);
    });

    // Analyze reactions services
    const reactions = services.filter(s => {
      const name = s.name.toLowerCase();
      const cat = s.category.toLowerCase();
      return (name.includes('reaction') || name.includes('react') || name.includes('like') || cat.includes('reaction') || cat.includes('like')) && 
             (name.includes('facebook') || cat.includes('facebook') || name.includes('fb') || cat.includes('fb'));
    });
    
    console.log(`\nReactions count: ${reactions.length}`);
    const sortedReactions = reactions.sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
    console.log('Cheapest 5 Reactions services:');
    sortedReactions.slice(0, 5).forEach(s => {
      console.log(`ID: ${s.service} | Rate: ${s.rate} | Name: ${s.name} | Cat: ${s.category} | Desc: ${s.desc ? s.desc.slice(0, 100) : 'none'}`);
    });

    // Analyze views services
    const views = services.filter(s => {
      const name = s.name.toLowerCase();
      const cat = s.category.toLowerCase();
      return (name.includes('view') || name.includes('watch') || cat.includes('view') || cat.includes('watch')) && 
             (name.includes('facebook') || cat.includes('facebook') || name.includes('fb') || cat.includes('fb'));
    });
    
    console.log(`\nViews count: ${views.length}`);
    const sortedViews = views.sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
    console.log('Cheapest 5 Views services:');
    sortedViews.slice(0, 5).forEach(s => {
      console.log(`ID: ${s.service} | Rate: ${s.rate} | Name: ${s.name} | Cat: ${s.category} | Desc: ${s.desc ? s.desc.slice(0, 100) : 'none'}`);
    });
    
  } else {
    console.error('Failed to fetch:', res.status);
  }
}

testFetch();
