import { PhotoGalleryService } from './src/services/PhotoGalleryService';

async function testPhotoGalleryAPI() {
  console.log('🔧 Testing Photo Gallery API at dev.guustudio.vn...\n');
  
  const galleryService = new PhotoGalleryService({
    apiUrl: 'https://dev.guustudio.vn/api.php'
  });

  try {
    // Test 1: Connection test
    console.log('1️⃣ Testing connection...');
    const connected = await galleryService.testConnection();
    console.log(`✅ Connection: ${connected ? 'SUCCESS' : 'FAILED'}\n`);

    // Test 2: Get categories
    console.log('2️⃣ Getting categories with stats...');
    const categories = await galleryService.getCategories(true);
    console.log(`✅ Found ${categories.length} categories:`);
    categories.forEach(cat => {
      console.log(`   - ${cat.category_name} (${cat.category_slug}): ${cat.folder_count} folders, ${cat.featured_images?.total || 0} featured`);
    });
    console.log('');

    // Test 3: Get featured images (all)
    console.log('3️⃣ Getting all featured images...');
    const allImages = await galleryService.getFeaturedImages({ limit: 5 });
    console.log(`✅ Found ${allImages.total_found} total featured images`);
    console.log(`   Returned ${allImages.images.length} images\n`);

    // Test 4: Get images by topic
    console.log('4️⃣ Testing topic-based image selection...');
    const topics = ['wedding photos', 'kỷ yếu trường', 'corporate event', 'ảnh thẻ'];
    
    for (const topic of topics) {
      const images = await galleryService.getImagesForTopic(topic, 'blog', 3);
      console.log(`   Topic "${topic}" → ${images.length} images found`);
    }
    console.log('');

    // Test 5: Test with no results (should generate mock images)
    console.log('5️⃣ Testing mock image generation...');
    const mockImages = galleryService.generateMockImagesForTopic('Test Wedding Content', 3);
    console.log(`✅ Generated ${mockImages.length} mock images`);
    mockImages.forEach((img, idx) => {
      console.log(`   - Image ${idx + 1}: ${img.metadata?.alt_text} (${img.thumbnail_url})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testPhotoGalleryAPI().then(() => {
  console.log('\n✅ Test completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
}); 