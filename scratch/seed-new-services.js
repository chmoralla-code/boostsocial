const postgres = require('postgres');

const connectionString = 'postgresql://postgres.bhunvginzhgnwjkprnxc:Baholobot12345@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres';
const sql = postgres(connectionString, { ssl: 'require' });

const servicesToSeed = [
  {
    id: '46a89c42-2d12-40e9-b5fc-112f45ea2e88',
    title: 'IG FOLLOWERS',
    starting_price: 0.02,
    icon_type: 'followers',
    description: {
      description: 'Premium active Instagram followers to boost your profile presence.',
      subtitle: 'INSTAGRAM FOLLOWERS',
      button_text: 'Boost Followers',
      min_quantity: 100,
      free_trial_amount: 50,
      custom_caption: '',
      custom_fields: []
    }
  },
  {
    id: 'ccb4766f-1249-43c2-a9b0-410a62abde12',
    title: 'IG LIKES',
    starting_price: 0.01,
    icon_type: 'reactions',
    description: {
      description: 'High-quality Instagram likes for your posts, reels, or IGTV.',
      subtitle: 'INSTAGRAM LIKES',
      button_text: 'Boost Likes',
      min_quantity: 100,
      free_trial_amount: 50,
      custom_caption: '',
      custom_fields: []
    }
  },
  {
    id: 'd50c76ab-8422-4936-a36c-27940ea56ac1',
    title: 'IG VIEWS',
    starting_price: 0.005,
    icon_type: 'views',
    description: {
      description: 'Instant high-retention video views for Instagram reels and videos.',
      subtitle: 'INSTAGRAM VIEWS',
      button_text: 'Boost Views',
      min_quantity: 100,
      free_trial_amount: 50,
      custom_caption: '',
      custom_fields: []
    }
  },
  {
    id: '2a98f123-1d42-45e3-82ef-fb347cda6541',
    title: 'TIKTOK FOLLOWERS',
    starting_price: 0.03,
    icon_type: 'followers',
    description: {
      description: 'Active TikTok followers to accelerate your profile growth.',
      subtitle: 'TIKTOK FOLLOWERS',
      button_text: 'Boost Followers',
      min_quantity: 100,
      free_trial_amount: 50,
      custom_caption: '',
      custom_fields: []
    }
  },
  {
    id: 'f78ab471-29cf-4ab8-9366-410adfac56a2',
    title: 'TIKTOK LIKES',
    starting_price: 0.015,
    icon_type: 'reactions',
    description: {
      description: 'Genuine TikTok likes/hearts to blow up your videos on the FYP.',
      subtitle: 'TIKTOK LIKES',
      button_text: 'Boost Likes',
      min_quantity: 100,
      free_trial_amount: 50,
      custom_caption: '',
      custom_fields: []
    }
  },
  {
    id: 'c4a7e936-d2bc-45aa-bb36-ab3cfda836cf',
    title: 'TIKTOK VIEWS',
    starting_price: 0.002,
    icon_type: 'views',
    description: {
      description: 'Instant TikTok video views for high exposure and algorithmic push.',
      subtitle: 'TIKTOK VIEWS',
      button_text: 'Boost Views',
      min_quantity: 100,
      free_trial_amount: 50,
      custom_caption: '',
      custom_fields: []
    }
  },
  {
    id: 'ab348d21-f123-45c1-bd76-e137fab62aa1',
    title: 'YT SUBSCRIBERS',
    starting_price: 0.15,
    icon_type: 'followers',
    description: {
      description: 'Non-drop active YouTube subscribers to reach monetization fast.',
      subtitle: 'YOUTUBE SUBSCRIBERS',
      button_text: 'Boost Subscribers',
      min_quantity: 50,
      free_trial_amount: 0,
      custom_caption: '',
      custom_fields: []
    }
  },
  {
    id: '67a3f892-db42-4751-bb38-410adfac29b1',
    title: 'YT LIKES',
    starting_price: 0.03,
    icon_type: 'reactions',
    description: {
      description: 'High quality YouTube likes for video ranking and social proof.',
      subtitle: 'YOUTUBE LIKES',
      button_text: 'Boost Likes',
      min_quantity: 100,
      free_trial_amount: 50,
      custom_caption: '',
      custom_fields: []
    }
  },
  {
    id: '57f3ab71-7c98-46ab-bbef-b31cfa286ac1',
    title: 'YT VIEWS',
    starting_price: 0.02,
    icon_type: 'views',
    description: {
      description: 'Safe, organic-style YouTube views with high retention rate.',
      subtitle: 'YOUTUBE VIEWS',
      button_text: 'Boost Views',
      min_quantity: 100,
      free_trial_amount: 50,
      custom_caption: '',
      custom_fields: []
    }
  }
];

async function seed() {
  try {
    console.log('Seeding new Instagram, TikTok, and YouTube services into the database...');
    for (const s of servicesToSeed) {
      const descJson = JSON.stringify(s.description);
      
      const existing = await sql`
        SELECT id FROM services WHERE id = ${s.id};
      `;
      
      if (existing.length > 0) {
        console.log(`Service already exists: ${s.title} (${s.id})`);
        continue;
      }

      await sql`
        INSERT INTO services (id, title, starting_price, icon_type, description)
        VALUES (${s.id}, ${s.title}, ${s.starting_price}, ${s.icon_type}, ${descJson});
      `;
      console.log(`Inserted service: ${s.title} (${s.id})`);
    }
    console.log('🎉 Seeding successfully completed!');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
  } finally {
    await sql.end();
  }
}

seed();
