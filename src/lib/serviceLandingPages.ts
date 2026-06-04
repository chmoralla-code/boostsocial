export type ServiceLandingPage = {
  slug: string;
  title: string;
  shortTitle: string;
  category: string;
  description: string;
  searchQuery: string;
  primaryHref: string;
  keywords: string[];
  highlights: string[];
  requirements: string[];
  faqs: Array<{ question: string; answer: string }>;
};

export const SERVICE_LANDING_PAGES: ServiceLandingPage[] = [
  {
    slug: "facebook-boosts",
    title: "Facebook Boosting Services",
    shortTitle: "Facebook",
    category: "Social Media Boosts",
    description: "Followers, page likes, post reactions, views, comments, and PH-base Facebook growth packages with GCash checkout and live tracking.",
    searchQuery: "facebook",
    primaryHref: "/?smm_search=facebook",
    keywords: ["facebook", "fb", "meta", "reaction", "followers", "page likes"],
    highlights: ["Page followers and profile followers", "Exact reactions like Like, Love, Care, Haha, Wow, Sad, and Angry", "Post views, comments, shares, and engagement packs"],
    requirements: ["Facebook page, profile, post, reel, or video link", "Public target link while the order is processing", "GCash receipt or wallet balance for payment"],
    faqs: [
      { question: "Can I choose exact Facebook reactions?", answer: "Yes. The catalog supports exact reaction searches such as Like, Love, Care, Haha, Wow, Sad, and Angry." },
      { question: "Where do I track my Facebook order?", answer: "After checkout, keep the Tracking ID and open the Track Order page any time." },
    ],
  },
  {
    slug: "instagram-boosts",
    title: "Instagram Boosting Services",
    shortTitle: "Instagram",
    category: "Social Media Boosts",
    description: "Instagram followers, post likes, reel likes, story likes, saves, shares, views, and profile impressions for creators and pages.",
    searchQuery: "instagram",
    primaryHref: "/?smm_search=instagram",
    keywords: ["instagram", "ig", "reels", "followers", "likes", "saves"],
    highlights: ["Followers, likes, views, saves, and shares", "Reel and story engagement options", "Budget-friendly catalog search for fast ordering"],
    requirements: ["Instagram profile, post, story, or reel link", "Public target link while the order is processing", "Correct quantity and payment screenshot"],
    faqs: [
      { question: "Do you support reels?", answer: "Yes. Search Instagram reels in the catalog to see reel likes, views, and related packages." },
      { question: "Can I order Instagram services from mobile?", answer: "Yes. Use the website or the APK app, then track the order with your Tracking ID." },
    ],
  },
  {
    slug: "tiktok-boosts",
    title: "TikTok Boosting Services",
    shortTitle: "TikTok",
    category: "Social Media Boosts",
    description: "TikTok followers, video hearts, views, favorites, comments, shares, and live engagement services with simple checkout.",
    searchQuery: "tiktok",
    primaryHref: "/?smm_search=tiktok",
    keywords: ["tiktok", "tt", "hearts", "views", "followers", "favorites"],
    highlights: ["Video hearts, views, favorites, shares, and comments", "Follower and live-like service options", "Fast catalog filtering for direct ordering"],
    requirements: ["TikTok profile, video, or live target link", "Public content during delivery", "GCash receipt or wallet balance"],
    faqs: [
      { question: "What TikTok link should I use?", answer: "Use the exact TikTok profile or video URL requested by the service you selected." },
      { question: "Can I search for cheaper TikTok services?", answer: "Yes. Open the catalog and sort/search by TikTok plus the action you need, like hearts or views." },
    ],
  },
  {
    slug: "youtube-boosts",
    title: "YouTube Boosting Services",
    shortTitle: "YouTube",
    category: "Social Media Boosts",
    description: "YouTube subscribers, views, watch support, Shorts likes, video likes, comments, and live engagement services.",
    searchQuery: "youtube",
    primaryHref: "/?smm_search=youtube",
    keywords: ["youtube", "yt", "subscribers", "shorts", "views", "likes"],
    highlights: ["Subscribers, views, likes, comments, and Shorts engagement", "Channel and video-targeted service options", "Order tracking after checkout"],
    requirements: ["YouTube channel, video, or Shorts URL", "Public target while processing", "Correct service quantity and payment proof"],
    faqs: [
      { question: "Do you offer YouTube Shorts likes?", answer: "Yes. Search YouTube Shorts in the catalog to open matching Shorts services." },
      { question: "Where do I check delivery status?", answer: "Use the Track Order page and paste your Tracking ID." },
    ],
  },
  {
    slug: "pisowifi-package",
    title: "PisoWiFi Package Setup",
    shortTitle: "PisoWiFi",
    category: "Network and Vendo Services",
    description: "PisoWiFi package setup for voucher portals, GCash QR payment flow, receipt uploads, and installation details for admin review.",
    searchQuery: "pisowifi",
    primaryHref: "/?smm_search=pisowifi",
    keywords: ["pisowifi", "piso wifi", "wifi vendo", "portal", "gcash"],
    highlights: ["Starter, professional, and enterprise package guidance", "GCash QR payment and receipt upload flow", "Manual admin review for setup details"],
    requirements: ["Router or vendo setup details", "GCash QR/payment preference", "Admin notes for location, network, or portal requirements"],
    faqs: [
      { question: "Is PisoWiFi a normal social boost?", answer: "No. PisoWiFi is a setup/package service, so checkout asks for setup details instead of a social media link." },
      { question: "Can I pay with GCash?", answer: "Yes. The checkout flow supports GCash receipt upload for admin verification." },
    ],
  },
  {
    slug: "facebook-page-setup",
    title: "Custom Facebook Page Setup",
    shortTitle: "Page Setup",
    category: "Done-for-you Page Build",
    description: "Custom Facebook page creation with profile assets, cover assets, bio setup, transfer link, and follower package options.",
    searchQuery: "facebook page setup",
    primaryHref: "/order-page",
    keywords: ["facebook page", "order page", "custom page", "page setup", "fb page"],
    highlights: ["Profile and cover image fields", "Bio, category, and transfer details", "Optional follower quantity tied to checkout"],
    requirements: ["Desired page name and category", "Profile/cover assets if available", "Facebook account link for transfer or admin chat"],
    faqs: [
      { question: "Do I need my own images?", answer: "You can upload profile and cover images during checkout, or add notes for the admin." },
      { question: "How long does page setup take?", answer: "The order page explains current timing and tracking after checkout." },
    ],
  },
];

export function getServiceLandingPage(slug: string) {
  return SERVICE_LANDING_PAGES.find((page) => page.slug === slug);
}

export function findServiceLandingPageForQuery(query: string) {
  const cleanQuery = query.toLowerCase();
  return SERVICE_LANDING_PAGES.find((page) =>
    page.keywords.some((keyword) => cleanQuery.includes(keyword))
  );
}
