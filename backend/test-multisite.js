// Test script for WordPress MultiSite functionality
// This demonstrates the 3-site setup for AI Content Agent

const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// WordPress sites configuration
const wordpressSites = {
  wedding: {
    id: "wedding",
    name: "Wedding Guustudio",
    url: "https://wedding.guustudio.vn",
    username: "admin",
    password: "NyND KliT 9Xu7 AsZ7 f4Zw KK3x",
    categories: [
      "Đám Cưới",
      "Pre-Wedding",
      "Wedding Photography",
      "Bridal",
      "Groom",
    ],
    keywords: [
      "cưới",
      "wedding",
      "đám cưới",
      "pre-wedding",
      "prewedding",
      "cô dâu",
      "chú rể",
      "bridal",
      "groom",
    ],
    isActive: true,
    priority: 100,
  },
  yearbook: {
    id: "yearbook",
    name: "Guu Kỷ Yếu",
    url: "https://guukyyeu.vn",
    username: "admin",
    password: "EA8k fhYC dtxc uoep sccx RP4P",
    categories: [
      "Kỷ Yếu",
      "Học Sinh",
      "Graduation",
      "School Photography",
      "Student Life",
    ],
    keywords: [
      "kỷ yếu",
      "graduation",
      "học sinh",
      "student",
      "school",
      "trường",
      "lớp",
      "class",
      "giáo dục",
    ],
    isActive: true,
    priority: 100,
  },
  main: {
    id: "main",
    name: "Guustudio Main",
    url: "https://guustudio.vn",
    username: "admin",
    password: "eMFx lKwu Xg3c 8ywT 0nlP lM0I",
    categories: [
      "Photography",
      "Portrait",
      "Corporate",
      "Events",
      "Lifestyle",
      "Art",
    ],
    keywords: [
      "photography",
      "chụp ảnh",
      "portrait",
      "corporate",
      "doanh nghiệp",
      "event",
      "sự kiện",
      "lifestyle",
    ],
    isActive: true,
    priority: 50,
  },
};

// Smart routing function
function determineTargetSite(content) {
  const contentText = `${content.title} ${content.body}`.toLowerCase();

  // Wedding content detection
  const weddingKeywords = wordpressSites.wedding.keywords;
  const weddingScore = weddingKeywords.reduce((score, keyword) => {
    return contentText.includes(keyword) ? score + 10 : score;
  }, 0);

  // Yearbook content detection
  const yearbookKeywords = wordpressSites.yearbook.keywords;
  const yearbookScore = yearbookKeywords.reduce((score, keyword) => {
    return contentText.includes(keyword) ? score + 10 : score;
  }, 0);

  // Return best match
  if (weddingScore > yearbookScore && weddingScore > 0) {
    return "wedding";
  } else if (yearbookScore > 0) {
    return "yearbook";
  } else {
    return "main";
  }
}

// API Endpoints
app.get("/api/v1/wordpress-multisite/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      multiSiteService: "operational",
      sites: {
        total: Object.keys(wordpressSites).length,
        active: Object.values(wordpressSites).filter((s) => s.isActive).length,
        inactive: 0,
      },
      version: "1.0.0",
      features: [
        "Smart content routing",
        "Multi-site publishing",
        "Cross-posting",
        "Connection testing",
        "AI-powered categorization",
      ],
    },
  });
});

app.get("/api/v1/wordpress-multisite/sites", (req, res) => {
  res.json({
    success: true,
    data: {
      sites: Object.values(wordpressSites).map((site) => ({
        id: site.id,
        name: site.name,
        url: site.url,
        isActive: site.isActive,
        categories: site.categories,
        keywords: site.keywords,
        priority: site.priority,
      })),
      totalSites: Object.keys(wordpressSites).length,
      activeSites: Object.values(wordpressSites).filter((s) => s.isActive)
        .length,
    },
  });
});

app.post("/api/v1/wordpress-multisite/preview-routing", (req, res) => {
  const { title, body, excerpt, categories, tags, contentType } = req.body;

  if (!title || !body) {
    return res.status(400).json({
      success: false,
      error: "Title and body are required for routing preview",
    });
  }

  const targetSiteId = determineTargetSite({ title, body, excerpt });
  const targetSite = wordpressSites[targetSiteId];

  const contentText = `${title} ${body} ${excerpt || ""}`.toLowerCase();
  const analysis = {
    targetSite: {
      id: targetSite.id,
      name: targetSite.name,
      url: targetSite.url,
      priority: targetSite.priority,
    },
    contentAnalysis: {
      wordCount: body.split(" ").length,
      categoryMatches: targetSite.categories.filter(
        (cat) =>
          categories?.some((c) =>
            c.toLowerCase().includes(cat.toLowerCase())
          ) || contentText.includes(cat.toLowerCase())
      ),
      keywordMatches: targetSite.keywords.filter((keyword) =>
        contentText.includes(keyword.toLowerCase())
      ),
    },
    confidence: targetSite.keywords.some((k) => contentText.includes(k))
      ? "High"
      : "Medium",
  };

  res.json({
    success: true,
    data: analysis,
  });
});

app.post("/api/v1/wordpress-multisite/smart-publish", (req, res) => {
  const { title, body, excerpt, categories, tags, contentType, targetSiteId } =
    req.body;

  if (!title || !body) {
    return res.status(400).json({
      success: false,
      error: "Title and body are required",
    });
  }

  const selectedSiteId =
    targetSiteId || determineTargetSite({ title, body, excerpt });
  const targetSite = wordpressSites[selectedSiteId];

  // Simulate publishing (in real implementation, this would call WordPress API)
  const mockResult = {
    success: true,
    data: {
      mainResult: {
        siteId: selectedSiteId,
        siteName: targetSite.name,
        postId: Math.floor(Math.random() * 1000) + 1,
        url: `${targetSite.url}/sample-post-${Date.now()}`,
      },
      allResults: [
        {
          siteId: selectedSiteId,
          siteName: targetSite.name,
          success: true,
          postId: Math.floor(Math.random() * 1000) + 1,
          url: `${targetSite.url}/sample-post-${Date.now()}`,
        },
      ],
      totalPublished: 1,
      errors: [],
    },
  };

  console.log(`📝 Smart published "${title}" to ${targetSite.name}`);

  res.json(mockResult);
});

app.get("/api/v1/wordpress-multisite/stats", (req, res) => {
  res.json({
    success: true,
    data: {
      multiSite: {
        totalSites: Object.keys(wordpressSites).length,
        activeSites: Object.values(wordpressSites).filter((s) => s.isActive)
          .length,
        routingRules: 3,
        siteStats: Object.values(wordpressSites).map((site) => ({
          siteId: site.id,
          siteName: site.name,
          isActive: site.isActive,
          categories: site.categories.length,
          keywords: site.keywords.length,
          priority: site.priority,
        })),
      },
      publishing: null,
      combined: {
        totalSites: Object.keys(wordpressSites).length,
        activeSites: Object.values(wordpressSites).filter((s) => s.isActive)
          .length,
        routingRules: 3,
      },
    },
  });
});

const PORT = 3001;
const HOST = "localhost";

app.listen(PORT, HOST, () => {
  console.log(
    `🚀 WordPress MultiSite Test Server running on http://${HOST}:${PORT}`
  );
  console.log(`📖 Test MultiSite API:`);
  console.log(
    `   - Health: http://${HOST}:${PORT}/api/v1/wordpress-multisite/health`
  );
  console.log(
    `   - Sites: http://${HOST}:${PORT}/api/v1/wordpress-multisite/sites`
  );
  console.log(
    `   - Preview: http://${HOST}:${PORT}/api/v1/wordpress-multisite/preview-routing`
  );
  console.log(
    `   - Smart Publish: http://${HOST}:${PORT}/api/v1/wordpress-multisite/smart-publish`
  );
  console.log(`🌍 3 WordPress Sites Configured:`);
  Object.values(wordpressSites).forEach((site) => {
    console.log(`   - ${site.name}: ${site.url}`);
  });
});
