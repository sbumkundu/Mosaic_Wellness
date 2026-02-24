// Entity extraction: products, order IDs, delivery partners, locations

export interface ExtractedEntities {
  products: Array<{ name: string; confidence: number }>;
  orderIds: string[];
  deliveryPartners: Array<{ name: string; confidence: number }>;
  locations: Array<{ name: string; type: "city" | "state" | "country" }>;
}

const ORDER_ID_PATTERNS = [
  /\b(OD|ORD|ORDER|AWB|MWOR|MW)[_-]?[0-9A-Z]{6,15}\b/gi,
  /\border\s*(?:id|number|no\.?|#)\s*:?\s*([A-Z0-9_-]{6,20})\b/gi,
  /\btracking\s*(?:id|number|no\.?|#)?\s*:?\s*([A-Z0-9_-]{8,25})\b/gi,
];

const DELIVERY_PARTNERS = [
  { names: ["delhivery", "delhivery express"], canonical: "Delhivery" },
  { names: ["bluedart", "blue dart"], canonical: "BlueDart" },
  { names: ["dunzo"], canonical: "Dunzo" },
  { names: ["ekart", "e-kart", "flipkart logistics"], canonical: "Ekart" },
  { names: ["xpressbees", "xpress bees"], canonical: "XpressBees" },
  { names: ["amazon logistics", "amazon delivery", "amzl"], canonical: "Amazon Logistics" },
  { names: ["shadowfax"], canonical: "Shadowfax" },
  { names: ["dtdc"], canonical: "DTDC" },
  { names: ["fedex"], canonical: "FedEx" },
  { names: ["india post", "speed post"], canonical: "India Post" },
];

const INDIAN_CITIES = [
  "mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "chennai", "pune", "kolkata",
  "ahmedabad", "surat", "jaipur", "lucknow", "kanpur", "nagpur", "indore", "bhopal",
  "visakhapatnam", "vizag", "patna", "vadodara", "ghaziabad", "ludhiana", "agra",
  "nashik", "faridabad", "meerut", "rajkot", "kalyan", "vasai", "varanasi",
  "srinagar", "chandigarh", "coimbatore", "mysore", "mysuru", "noida", "gurgaon",
  "gurugram", "kochi", "cochin", "bhubaneswar", "dehradun", "thiruvananthapuram",
];

const INDIAN_STATES = [
  "maharashtra", "delhi", "karnataka", "telangana", "andhra pradesh", "tamil nadu",
  "gujarat", "rajasthan", "uttar pradesh", "west bengal", "bihar", "madhya pradesh",
  "kerala", "punjab", "haryana", "odisha", "jharkhand", "assam", "uttarakhand",
  "himachal pradesh", "goa", "manipur", "meghalaya", "nagaland", "tripura",
];

const MW_PRODUCTS = [
  "glow serum", "vitamin c face wash", "collagen night cream", "hair growth oil",
  "biotin gummies", "immunity boost powder", "sunscreen spf50", "sunscreen",
  "lip balm", "anti-dandruff shampoo", "protein hair mask",
  // generic
  "serum", "face wash", "night cream", "hair oil", "gummies", "shampoo", "mask",
];

export function extractEntities(text: string, productCatalog: string[] = []): ExtractedEntities {
  const lower = text.toLowerCase();
  const allProducts = [...MW_PRODUCTS, ...productCatalog.map(p => p.toLowerCase())];
  
  // Extract order IDs
  const orderIds: string[] = [];
  for (const pattern of ORDER_ID_PATTERNS) {
    const matches = Array.from(text.matchAll(new RegExp(pattern.source, "gi")));
    for (const match of matches) {
      const id = match[1] || match[0];
      if (id && !orderIds.includes(id.toUpperCase())) {
        orderIds.push(id.toUpperCase());
      }
    }
  }
  
  // Extract delivery partners
  const deliveryPartners: Array<{ name: string; confidence: number }> = [];
  for (const { names, canonical } of DELIVERY_PARTNERS) {
    for (const name of names) {
      if (lower.includes(name)) {
        if (!deliveryPartners.some(d => d.name === canonical)) {
          deliveryPartners.push({ name: canonical, confidence: 0.95 });
        }
        break;
      }
    }
  }
  
  // Extract products
  const products: Array<{ name: string; confidence: number }> = [];
  for (const product of allProducts) {
    if (lower.includes(product)) {
      const existing = products.find(p => p.name.toLowerCase() === product);
      if (!existing) {
        // Score higher for specific products
        const confidence = product.length > 8 ? 0.9 : 0.7;
        products.push({ name: product, confidence });
      }
    }
  }
  // Deduplicate: if short name is substring of longer, remove short
  const filteredProducts = products.filter(p => 
    !products.some(q => q.name !== p.name && q.name.toLowerCase().includes(p.name.toLowerCase()) && q.name.length > p.name.length)
  );
  
  // Extract locations
  const locations: Array<{ name: string; type: "city" | "state" | "country" }> = [];
  for (const city of INDIAN_CITIES) {
    if (lower.includes(city)) {
      // Capitalize properly
      const capitalized = city.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      if (!locations.some(l => l.name.toLowerCase() === city)) {
        locations.push({ name: capitalized, type: "city" });
      }
    }
  }
  for (const state of INDIAN_STATES) {
    if (lower.includes(state)) {
      const capitalized = state.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      if (!locations.some(l => l.name.toLowerCase() === state)) {
        locations.push({ name: capitalized, type: "state" });
      }
    }
  }
  
  return {
    products: filteredProducts,
    orderIds,
    deliveryPartners,
    locations,
  };
}
